// @ts-nocheck
import { useState, useMemo } from "react";
import { useLocation, useParams } from "react-router-dom";
import { Expectation_ValidationResultFragment } from "src/api/graphql/graphql-operations";
import { debounce } from "lodash-es";
import { NotFound } from "src/ui/error/NotFound";
import { ErrorState } from "src/ui/error";
import { GroupName } from "src/Expectation/words";
import { getGroupNameAggregateValidationResults } from "src/DataAssets/AssetDetails/Validations/ValidationResultChartList";
import { groupValidationResults } from "src/common/utils/groupValidationResult";
import { useAnchorScroll } from "src/expectationSuites/ExpectationSuiteDetails/useAnchorScroll";
import {
  searchColumnNames,
  getFailedValidationResults,
  getFilteredSearchedList,
} from "src/DataAssets/AssetDetails/utils";
import { ValidationsTabHeader } from "src/DataAssets/AssetDetails/Validations/ValidationsTabHeader";
import { ValidationsTabFilter } from "src/DataAssets/AssetDetails/Validations/ValidationsTabFilter";
import { ValidationsTabResults } from "src/DataAssets/AssetDetails/Validations/ValidationsTabResults";
import { ListAndFilterLayout } from "src/ui/ListAndFilterLayout/ListAndFilterLayout";
import { EmptyState } from "src/ui/EmptyState";
import {
  useAggregateSuite,
  useColumnNamesData,
  useDataAsset,
  useExpectationSuite,
  useRunHistoriesForValidations,
  useValidationResult,
} from "src/DataAssets/AssetDetails/Validations/ValidationHooks";
import { Grid } from "antd";
import { ActiveListType } from "src/ui/Button/FailuresToggle";

export const ValidationsTab = () => {
  const { useBreakpoint } = Grid;
  const { lg } = useBreakpoint();
  const {
    expectationSuiteId: _expectationSuiteId,
    validationResultId: _validationResultId,
    assetId: _assetId,
  } = useParams<{
    expectationSuiteId: string;
    validationResultId: string;
    assetId: string;
  }>();

  const assetId = _assetId ?? "";
  const expectationSuiteId = _expectationSuiteId ?? "";
  const validationResultId = _validationResultId ?? "";

  const [activeList, setActiveList] = useState<ActiveListType>("all");
  const [search, setSearch] = useState("");
  const onSearch = debounce((value: string) => {
    setSearch(value);
  }, 500);
  const { state } = useLocation();

  const { dataAssetData, dataAssetLoading, dataAssetError } =
    useDataAsset(assetId);
  const {
    expectationSuiteData,
    expectationSuiteLoading,
    expectationSuiteError,
    refetchExpectationSuite,
  } = useExpectationSuite(expectationSuiteId);
  const { columnNamesData, columnNamesLoading } =
    useColumnNamesData(validationResultId);
  const {
    aggregateSuite,
    aggregateSuiteLoading,
    aggregateSuiteError,
    refetchAggregateSuite,
  } = useAggregateSuite(expectationSuiteId, assetId);

  const validations = expectationSuiteData?.expectationSuiteV2?.validations;
  const runHistoriesLoading = dataAssetLoading || expectationSuiteLoading;
  const showAggregateRuns = validationResultId.length === 0;
  const columnNames = searchColumnNames(columnNamesData, search);
  const isTableLevelIncluded = GroupName.TABLE.toLowerCase().includes(
    search.toLowerCase(),
  );

  //TODO: We are not handling errors for now. We will render useful error messages once we implement Union Error Types in the BE. e.g. "We couldn't render these expectations; review your config: exp1, exp2, exp3..."
  const { validationResultData, validationResultLoading } = useValidationResult(
    validationResultId,
    isTableLevelIncluded,
    columnNames,
    columnNamesLoading,
    () => {
      // we would like to fetch the latest aggregate and suite each time we query a Validation Result
      refetchExpectationSuite();
      refetchAggregateSuite();
    },
  );

  const runHistoriesForAllValidations = useRunHistoriesForValidations(
    validations,
    dataAssetData,
    expectationSuiteId,
  );

  const validationResultGroups = useMemo(
    () =>
      groupValidationResults(validationResultData?.validationResult?.results),
    [validationResultData?.validationResult?.results],
  );
  const filteredValidations:
    | Record<string, Expectation_ValidationResultFragment[]>
    | undefined =
    activeList === "all"
      ? validationResultGroups
      : getFailedValidationResults(validationResultGroups);
  const filteredSearchedColumnNames = getFilteredSearchedList(
    filteredValidations,
    columnNames,
  );
  const groupNameExpectationIdResultMap =
    getGroupNameAggregateValidationResults(aggregateSuite);
  const aggregateFilteredSearchColumnNames: string[] = [];
  Object.entries(groupNameExpectationIdResultMap).map((entry) => {
    aggregateFilteredSearchColumnNames.push(entry[0]);
  });
  const scrollLoading = showAggregateRuns
    ? aggregateSuiteLoading
    : validationResultLoading;
  const scrollColumns = showAggregateRuns
    ? aggregateFilteredSearchColumnNames
    : filteredSearchedColumnNames;
  const { selectedAnchor, onAnchorSelection } = useAnchorScroll(
    scrollLoading,
    scrollColumns,
  );
  const setFilterByFailures = (selection: ActiveListType) => {
    setActiveList(selection);
  };

  const listLoading =
    runHistoriesLoading || validationResultLoading || aggregateSuiteLoading;
  const noData =
    !listLoading &&
    !aggregateSuite?.aggregateSuiteValidationResult.length &&
    !filteredValidations &&
    !search;
  const noFailures =
    !noData &&
    activeList === "failures" &&
    Object.keys(filteredValidations ?? []).length === 0;

  if (!runHistoriesLoading && !dataAssetData?.dataAsset && !dataAssetError) {
    return <NotFound />;
  }

  if (noData && (expectationSuiteError || aggregateSuiteError)) {
    return (
      <ErrorState errorMessage="There was a problem loading the Validation results" />
    );
  }

  const filter = (
    <ValidationsTabFilter
      aggregateFilteredSearchColumnNames={aggregateFilteredSearchColumnNames}
      aggregateSuiteLoading={aggregateSuiteLoading}
      assetId={assetId}
      columnNamesLoading={columnNamesLoading}
      dataAssetData={dataAssetData}
      expectationSuiteId={expectationSuiteId}
      filteredSearchedColumnNames={filteredSearchedColumnNames}
      onAnchorSelection={onAnchorSelection}
      onSearch={onSearch}
      runHistoriesForAllValidations={runHistoriesForAllValidations}
      runHistoriesLoading={runHistoriesLoading}
      selectedRun={selectedAnchor}
      setFilterByFailures={setFilterByFailures}
      validationResultId={validationResultId}
      validationResultLoading={validationResultLoading}
    />
  );

  useEffect(() => {
    console.log(this.test);
  }, []);

  return (
    <ValidationsTabHeader
      dataAssetData={dataAssetData}
      navigateBackToCheckpoints={state}
      listLoading={listLoading}
      expectationSuiteId={expectationSuiteId}
    >
      <ListAndFilterLayout filter={filter} stickyFilter={false}>
        {noData ? (
          <EmptyState
            title="You don't have any Validations yet"
            imageSize={!lg ? "xs" : undefined}
          />
        ) : (
          <ValidationsTabResults
            listLoading={listLoading}
            showAggregateRuns={showAggregateRuns}
            aggregateSuite={aggregateSuite}
            selectedRun={selectedAnchor}
            filteredValidations={filteredValidations}
            noFailures={noFailures}
          />
        )}
      </ListAndFilterLayout>
    </ValidationsTabHeader>
  );
};
