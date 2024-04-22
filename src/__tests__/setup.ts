import { createFsFromVolume, Volume } from "memfs";

/**
 * Standard JS default export
 */
export const defaultExport = "/defaultExport.js";
export const DefaultExport: string = `export default {
    data() {
        return {
            item: 'test'
        }
    },
    setup() {
        console.log(this.item);
    }
}
`;

/**
 * Empty JS File
 */
export const emptyFile = "/emptyFile.js";
export const EmptyFile: string = ``;

/**
 * JS Basics
 */
export const jsBasics = "/jsBasics.js";
export const JSBasics: string = `const arrowFunction = () => {};
function standardFunction() {}
let varFunction = function () {};
let x = "blue";

const objectExample = {
  a: "this is a",
  b: {
    value: "this is b",
  },
  c: function innerPropFunction() {
    const yellow = {
      ay: "blue",
      by: "yellow",
      cy() {
        return {
          dx: {
            ez: () => {
              return {
                b: "test",
              };
            },
          },
        };
      },
    };
    console.log("this is c");
    console.log(yellow);
  },
  ez: {
    another: "test",
  },
  d() {
    console.log("this is d");
  },
  e: () => {
    console.log("this is e");
  },
  f: arrowFunction,
  g: standardFunction,
  h: varFunction,
};
`;

/**
 * Full Vue SFC
 */
export const fullVueSFC = "/fullVueSFC.vue";
export const FullVueSFC: string = `<template>
  <div class="details-container">
    <div class="container-left">
      <SectionCard
        ><slot name="detailHeader" v-bind:memberName="headerMemberName"
      /></SectionCard>
      <SectionCard :sectionCardAdditionalClasses="sectionCardAdditionalClasses"
        ><slot name="detailBody"
      /></SectionCard>
    </div>
    <div class="container-right">
      <SectionCard>
        <h2 class="card-header">{{ t("sideDetailHeader") }}</h2>
        <div class="case-status-wrapper">
          <div class="case-status-title">{{ t("sideDetailStatusLabel") }}</div>
          <a-select
            size="small"
            class="case-status-select"
            :class="statusColor"
            :disabled="disableDropdown"
            :dropdownMatchSelectWidth="false"
            v-model:value="selectedStatus"
            @change="statusChange"
          >
            <a-select-option
              v-for="(option, idx) in statusOptions"
              :key="idx"
              :value="option.value"
            >
              {{ option.displayValue }}
            </a-select-option>
          </a-select>
        </div>
        <div class="case-assignee-wrapper">
          <div class="case-assignee-title">
            {{ t("sideDetailAssigneeLabel") }}
          </div>
          <DropdownSearchWithIcon
            size="small"
            :optionsArr="specificWorkspaceUsers"
            :placeholderText="t('assignee.placeholder')"
            :prefilledValue="assigneeId"
            :loading="disableDropdown"
            :disabled="disableDropdown"
            :deSelectEnabled="true"
            class="assignee-search"
            @selectedKey="handleSelectedKey"
          />
        </div>
        <a-divider />
        <ul
          class="case-sub-details"
          v-for="(val, key) in formattedSubDetails"
          :key="key"
        >
          <li class="sub-detail" v-if="val">
            <FontAwesomeIcon
              :icon="CASE_DETAIL_ICONS[key]"
              class="sub-detail-icon"
            /><span class="sub-detail-text">{{ val }}</span>
          </li>
        </ul>
      </SectionCard>
      <SectionCard>
        <h2 class="card-header">{{ t("sideAccountsOverviewHeader") }}</h2>
        <ul
          class="account-sub-details"
          v-for="(val, key) in formattedAccountDetails"
          :key="key"
        >
          <li class="sub-detail">
            <FontAwesomeIcon
              :icon="CASE_DETAIL_ICONS[key]"
              class="sub-detail-icon"
            /><span class="sub-detail-text">{{ val }}</span>
          </li>
        </ul>
        <section class="account-section">
          <router-link :to="toMembers" class="link" v-if="details.id">
            <font-awesome-icon
              icon="fa-solid fa-circle-user"
              class="view-link"
            />
            <span>{{ t("viewAccount") }}</span>
          </router-link>
        </section>
      </SectionCard>
    </div>
  </div>
</template>

<script>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import ApiService from "@/api/apiService";
import { mapState, mapGetters, mapActions, mapMutations, useStore } from "vuex";
import SectionCard from "@/components/common/SectionCard";
import { formatDateToDayMonthShortYear } from "@/utils/formatter";
import {
  CASE_DETAIL_ICONS,
  ASSIGNABLE_USER_TYPE,
} from "@/constants/crm/properties";
import parsePhoneNumber from "libphonenumber-js";
import LOCALE from "@/constants/common/locale";
import DropdownSearchWithIcon from "@/components/common/DropdownSearchWithIcon";
import isEmpty from "lodash/isEmpty";
import { getActiveWorkspace } from "@/utils/activeWorkspace";

function testingFunctions() {
  // function declaration
  console.log("bluey");
  console.log(this.test);
}

function closureTest() {
  return function secondClosure() {
    console.log("this", this.test);
  };
}

const arrowFunctions = () => {
  // arrow function expression
  console.log(this.test);
};

const expressionTest = function () {
  console.log(this.test);
};

export default {
  name: "CaseDetailsView",
  components: {
    SectionCard,
    DropdownSearchWithIcon,
  },
  setup() {
    const store = useStore();
    const caseSubDetails = computed(() => {
      return {
        case_id: store.state.casesDetails.id,
        location:
          store.state.viewableWorkspaces.find(
            (workspace) =>
              workspace.id === store.state.casesDetails.app_workspace_id,
          )?.name || "",
        created_at: store.state.casesDetails.created_at,
        created_by: store.state.casesDetails.created_by,
        test() {
          console.log("howdy", this.test);
        },
      };
    });
    const { t } = useI18n({
      locale: "en",
      messages: {
        en: {
          sideDetailHeader: "Case Details",
          sideAccountsOverviewHeader: "Accounts Overview",
          caseSubCreatedAt: "Created {date}",
          caseSubCreatedBy: "Created by {name}",
          sideDetailStatusLabel: "Status",
          sideDetailAssigneeLabel: "Assignee",
          viewAccount: "View Account",
          assignee: {
            placeholder: "Unassigned",
            updated: "Assignee Updated",
          },
          statusUpdated: "Status Updated",
        },
      },
    });

    return {
      t,
      caseSubDetails,
      caseSubCreatedBy: computed(() =>
        t("caseSubCreatedBy", {
          name: "test",
        }),
      ),
      caseSubCreatedAt: computed(() =>
        t("caseSubCreatedAt", {
          date: formatDateToDayMonthShortYear(caseSubDetails.value.created_at),
        }),
      ),
      assigneeUpdated: computed(() => t("assignee.updated", this.test)),
      statusUpdated: computed(() => t("statusUpdated")),
    };
  },
  test: {
    item() {
      console.log(this.test);
    },
  },
  data() {
    return {
      details: {},
      disableDropdown: false,
      selectedStatus: "",
      bloop() {
        return this.smack;
      },
    };
  },
  created() {
    const workspaceQuery = this.$route.query?.workspace;
    if (workspaceQuery && workspaceQuery !== getActiveWorkspace().id) {
      const targetWorkspace = this.workspaces.find(
        (ws) => ws.id === workspaceQuery,
      );
      const basePath = "cases";
      if (targetWorkspace) {
        this.setWorkspaceSwitchWarning({
          visible: true,
          target: targetWorkspace,
          basePath,
        });
      } else {
        this.$router.push({ name: basePath });
      }
    }

    this.details = {};
    this.clearCaseDetails();
    this.clearSpecificWorkspaceUsers();
    this.CASE_DETAIL_ICONS = CASE_DETAIL_ICONS;
    this.getCaseDetailsByCaseId(this.$route.params.caseId).then(() => {
      this.selectedStatus = this.casesDetails.status;
      this.getMembersAccountDetails(this.casesDetails.account_id).then(
        (res) => {
          this.details = res;
        },
      );
      this.loadSpecificWorkspaceUsers({
        workspaceId: this.casesDetails.app_workspace_id,
        type: ASSIGNABLE_USER_TYPE.case,
      });
    });
    if (!this.workspaceConfigs.case_types?.length) {
      this.loadWorkspaceConfigs().then(() => {});
    }
  },
  computed: {
    ...mapState({
      casesDetails: "casesDetails",
      workspaces: "workspaces",
      specificWorkspaceUsers: (state) =>
        state.specificWorkspaceUsers.map((account) => {
          return {
            name: "test",
            wackyItemName: "test",
            id: account.id,
          };
        }),
      workspaceConfigs: "workspaceConfigs",
    }),
    ...mapGetters(["caseStatusDropdown"]),
    statusOptions() {
      if (isEmpty(this.caseStatusDropdown) || !this.casesDetails.type) {
        return [];
      }

      const dropdownType = this.caseStatusDropdown[this.casesDetails.type];
      return Object.keys(dropdownType).reduce((result, key) => {
        if (
          this.casesDetails.status === undefined ||
          (!!this.casesDetails.status &&
            this.casesDetails.status !== "" &&
            dropdownType[key].value !== "") ||
          (!!this.casesDetails.status && this.casesDetails.status === "")
        ) {
          result.push(dropdownType[key]);
        }
        return result;
      }, []);
    },
    statusColor() {
      if (isEmpty(this.caseStatusDropdown) || !this.casesDetails.type) {
        return "";
      }
      return this.caseStatusDropdown[this.casesDetails.type][
        this.selectedStatus
      ]?.color;
    },
    assigneeId() {
      return this.specificWorkspaceUsers.find(
        (user) => user.id === this.casesDetails.assignee_id,
      )?.id;
    },
    formattedSubDetails() {
      return {
        ...this.caseSubDetails,
        created_by: this.caseSubDetails?.created_by
          ? this.caseSubCreatedBy
          : null,
        created_at: this.caseSubCreatedAt,
      };
    },
    formattedAccountDetails() {
      return {
        name: this.details.name,
        phone_number: this.details.phone_number
          ? parsePhoneNumber(this.details.phone_number, "US")?.format(
              "NATIONAL",
            )
          : "",
        email_address: this.details.email_address,
        preferred_language:
          LOCALE[this.details.preferred_language] ||
          this.details.preferred_language,
      };
    },
    sectionCardAdditionalClasses() {
      return ["detail-body-section"];
    },
    toMembers() {
      return {
        name: "account-details",
        params: { accountId: this.details.id },
      };
    },
    headerMemberName() {
      return this.details.name;
    },
  },
  methods: {
    ...mapActions([
      "getCaseDetailsByCaseId",
      "getMembersAccountDetails",
      "loadSpecificWorkspaceUsers",
      "loadWorkspaceConfigs",
    ]),
    ...mapMutations([
      "clearSpecificWorkspaceUsers",
      "clearCaseDetails",
      "setWorkspaceSwitchWarning",
      this.checkNames,
    ]),
    handleSelectedKey(assigneeId) {
      this.disableDropdown = true;

      ApiService.updateCase(this.caseSubDetails.case_id, {
        assignee_id: assigneeId === undefined ? null : assigneeId,
      })
        .then(() => {
          this.$message.success(this.assigneeUpdated);
        })
        .catch((error) => {
          this.$message.error(
            error.response.data.detail || error.response.data.assignee_id,
          );
        })
        .finally(() => {
          this.disableDropdown = false;
        });
    },
    statusChange() {
      this.disableDropdown = true;
      ApiService.updateCase(this.caseSubDetails.case_id, {
        status: this.selectedStatus,
      })
        .then(() => {
          this.$message.success(this.statusUpdated);
          this.getCaseDetailsByCaseId(this.$route.params.caseId);
        })
        .catch((error) => {
          this.selectedStatus = this.casesDetails.status;
          this.$message.error(error.response.data.detail);
        })
        .finally(() => {
          this.disableDropdown = false;
        });
    },
  },
};
</script>

<style lang="less" scoped>
.assignee-search {
  min-width: auto;
  width: 100%;
  overflow: hidden;
}

.view-link {
  height: 1rem;
}

.account-section {
  margin-top: 1rem;
}

.link {
  min-width: 6rem;
  height: 3.5rem;
  border-radius: 8px;
  padding: 0.5625rem 0.4688rem;
  display: inline-flex;
  flex-direction: column;
  justify-content: center;
  color: @systemBlue;
  background-color: .color(@systemBlue, @quaternary) [];
}

:deep(.detail-body-section) {
  padding-left: 0;
  padding-right: 0;
}

.details-container {
  display: grid;
  grid-template-columns: 65% 35%;
  grid-column-gap: 0.625rem;
}

:deep(.section-card) {
  padding-top: 1.5rem;
  padding-bottom: 1.5rem;
}

.card-header {
  font-weight: 600;
  font-size: 1.25rem;
  line-height: 1.75rem;
}

.card-header,
.case-status-wrapper {
  margin-bottom: 1rem;
}

.case-status-wrapper,
.case-assignee-wrapper {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.case-status-title,
.case-assignee-title {
  min-width: 3.75rem;
}

.case-status-select {
  :deep(.ant-select-selection) {
    color: @secondaryLabel;
  }
  :deep(.ant-select-arrow) {
    color: @secondaryLabel;
  }
  &.indigo :deep(.ant-select-selection) {
    background-color: .color(@systemIndigo, @tertiary) [];
    border-color: .color(@systemIndigo, @secondary) [];
  }
  &.red :deep(.ant-select-selection) {
    background-color: .color(@systemRed, @tertiary) [];
    border-color: .color(@systemRed, @secondary) [];
  }
  &.green :deep(.ant-select-selection) {
    background-color: .color(@systemGreen, @tertiary) [];
    border-color: .color(@systemGreen, @secondary) [];
  }
  &.gray :deep(.ant-select-selection) {
    background-color: .color(@systemGray, @tertiary) [];
    border-color: .color(@systemGray, @secondary) [];
  }
}

.case-sub-details {
  display: flex;
  flex-wrap: wrap;
}

.account-sub-details + .account-sub-details,
.case-sub-details + .case-sub-details {
  margin-top: 1rem;
}

.sub-detail-text {
  margin-left: 0.5rem;
  color: @secondaryLabel;
}

.sub-detail-icon {
  color: @quaternaryLabel;
}
</style>
`;

/**
 * Vue SFC Only JS portion
 */
export const vueSFCOnlyJS = "/vueSFCOnlyJS.js";
export const VueSFCOnlyJS = `import { computed } from "vue";
import { useI18n } from "vue-i18n";
import ApiService from "@/api/apiService";
import { mapState, mapGetters, mapActions, mapMutations, useStore } from "vuex";
import SectionCard from "@/components/common/SectionCard";
import { formatDateToDayMonthShortYear } from "@/utils/formatter";
import {
  CASE_DETAIL_ICONS,
  ASSIGNABLE_USER_TYPE,
} from "@/constants/crm/properties";
import parsePhoneNumber from "libphonenumber-js";
import LOCALE from "@/constants/common/locale";
import DropdownSearchWithIcon from "@/components/common/DropdownSearchWithIcon";
import isEmpty from "lodash/isEmpty";
import { getActiveWorkspace } from "@/utils/activeWorkspace";

function testingFunctions() {
  // function declaration
  console.log("bluey");
  console.log(this.test);
}

function closureTest() {
  return function secondClosure() {
    console.log("this", this.test);
  };
}

const arrowFunctions = () => {
  // arrow function expression
  console.log(this.test);
};

const expressionTest = function () {
  console.log(this.test);
};

export default {
  name: "CaseDetailsView",
  components: {
    SectionCard,
    DropdownSearchWithIcon,
  },
  setup() {
    const store = useStore();
    const caseSubDetails = computed(() => {
      return {
        case_id: store.state.casesDetails.id,
        location:
          store.state.viewableWorkspaces.find(
            (workspace) =>
              workspace.id === store.state.casesDetails.app_workspace_id,
          )?.name || "",
        created_at: store.state.casesDetails.created_at,
        created_by: store.state.casesDetails.created_by,
        test() {
          console.log("howdy", this.test);
        },
      };
    });
    const { t } = useI18n({
      locale: "en",
      messages: {
        en: {
          sideDetailHeader: "Case Details",
          sideAccountsOverviewHeader: "Accounts Overview",
          caseSubCreatedAt: "Created {date}",
          caseSubCreatedBy: "Created by {name}",
          sideDetailStatusLabel: "Status",
          sideDetailAssigneeLabel: "Assignee",
          viewAccount: "View Account",
          assignee: {
            placeholder: "Unassigned",
            updated: "Assignee Updated",
          },
          statusUpdated: "Status Updated",
        },
      },
    });

    return {
      t,
      caseSubDetails,
      caseSubCreatedBy: computed(() =>
        t("caseSubCreatedBy", {
          name: "test",
        }),
      ),
      caseSubCreatedAt: computed(() =>
        t("caseSubCreatedAt", {
          date: formatDateToDayMonthShortYear(caseSubDetails.value.created_at),
        }),
      ),
      assigneeUpdated: computed(() => t("assignee.updated", this.test)),
      statusUpdated: computed(() => t("statusUpdated")),
    };
  },
  test: {
    item() {
      console.log(this.test);
    },
  },
  data() {
    return {
      details: {},
      disableDropdown: false,
      selectedStatus: "",
      bloop() {
        return this.smack;
      },
    };
  },
  created() {
    const workspaceQuery = this.$route.query?.workspace;
    if (workspaceQuery && workspaceQuery !== getActiveWorkspace().id) {
      const targetWorkspace = this.workspaces.find(
        (ws) => ws.id === workspaceQuery,
      );
      const basePath = "cases";
      if (targetWorkspace) {
        this.setWorkspaceSwitchWarning({
          visible: true,
          target: targetWorkspace,
          basePath,
        });
      } else {
        this.$router.push({ name: basePath });
      }
    }

    this.details = {};
    this.clearCaseDetails();
    this.clearSpecificWorkspaceUsers();
    this.CASE_DETAIL_ICONS = CASE_DETAIL_ICONS;
    this.getCaseDetailsByCaseId(this.$route.params.caseId).then(() => {
      this.selectedStatus = this.casesDetails.status;
      this.getMembersAccountDetails(this.casesDetails.account_id).then(
        (res) => {
          this.details = res;
        },
      );
      this.loadSpecificWorkspaceUsers({
        workspaceId: this.casesDetails.app_workspace_id,
        type: ASSIGNABLE_USER_TYPE.case,
      });
    });
    if (!this.workspaceConfigs.case_types?.length) {
      this.loadWorkspaceConfigs().then(() => {});
    }
  },
  computed: {
    ...mapState({
      casesDetails: "casesDetails",
      workspaces: "workspaces",
      specificWorkspaceUsers: (state) =>
        state.specificWorkspaceUsers.map((account) => {
          return {
            name: "test",
            wackyItemName: "test",
            id: account.id,
          };
        }),
      workspaceConfigs: "workspaceConfigs",
    }),
    ...mapGetters(["caseStatusDropdown"]),
    statusOptions() {
      if (isEmpty(this.caseStatusDropdown) || !this.casesDetails.type) {
        return [];
      }

      const dropdownType = this.caseStatusDropdown[this.casesDetails.type];
      return Object.keys(dropdownType).reduce((result, key) => {
        if (
          this.casesDetails.status === undefined ||
          (!!this.casesDetails.status &&
            this.casesDetails.status !== "" &&
            dropdownType[key].value !== "") ||
          (!!this.casesDetails.status && this.casesDetails.status === "")
        ) {
          result.push(dropdownType[key]);
        }
        return result;
      }, []);
    },
    statusColor() {
      if (isEmpty(this.caseStatusDropdown) || !this.casesDetails.type) {
        return "";
      }
      return this.caseStatusDropdown[this.casesDetails.type][
        this.selectedStatus
      ]?.color;
    },
    assigneeId() {
      return this.specificWorkspaceUsers.find(
        (user) => user.id === this.casesDetails.assignee_id,
      )?.id;
    },
    formattedSubDetails() {
      return {
        ...this.caseSubDetails,
        created_by: this.caseSubDetails?.created_by
          ? this.caseSubCreatedBy
          : null,
        created_at: this.caseSubCreatedAt,
      };
    },
    formattedAccountDetails() {
      return {
        name: this.details.name,
        phone_number: this.details.phone_number
          ? parsePhoneNumber(this.details.phone_number, "US")?.format(
              "NATIONAL",
            )
          : "",
        email_address: this.details.email_address,
        preferred_language:
          LOCALE[this.details.preferred_language] ||
          this.details.preferred_language,
      };
    },
    sectionCardAdditionalClasses() {
      return ["detail-body-section"];
    },
    toMembers() {
      return {
        name: "account-details",
        params: { accountId: this.details.id },
      };
    },
    headerMemberName() {
      return this.details.name;
    },
  },
  methods: {
    ...mapActions([
      "getCaseDetailsByCaseId",
      "getMembersAccountDetails",
      "loadSpecificWorkspaceUsers",
      "loadWorkspaceConfigs",
    ]),
    ...mapMutations([
      "clearSpecificWorkspaceUsers",
      "clearCaseDetails",
      "setWorkspaceSwitchWarning",
      this.checkNames,
    ]),
    handleSelectedKey(assigneeId) {
      this.disableDropdown = true;

      ApiService.updateCase(this.caseSubDetails.case_id, {
        assignee_id: assigneeId === undefined ? null : assigneeId,
      })
        .then(() => {
          this.$message.success(this.assigneeUpdated);
        })
        .catch((error) => {
          this.$message.error(
            error.response.data.detail || error.response.data.assignee_id,
          );
        })
        .finally(() => {
          this.disableDropdown = false;
        });
    },
    statusChange() {
      this.disableDropdown = true;
      ApiService.updateCase(this.caseSubDetails.case_id, {
        status: this.selectedStatus,
      })
        .then(() => {
          this.$message.success(this.statusUpdated);
          this.getCaseDetailsByCaseId(this.$route.params.caseId);
        })
        .catch((error) => {
          this.selectedStatus = this.casesDetails.status;
          this.$message.error(error.response.data.detail);
        })
        .finally(() => {
          this.disableDropdown = false;
        });
    },
  },
};
`;

/**
 * Standard React Component
 */
export const reactComponent = "/reactComponent.tsx";
export const ReactComponent = `import { useState, useMemo } from "react";
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
  const [test, setTest] = useState(false);
  const onSearch = debounce((value: string) => {
    setSearch(value);
  }, 500);
  const { state } = useLocation();

  console.log(test);
  setTest(true);
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
`;
/**
 * Mocked volume & fileSystem
 */
export const volume = Volume.fromJSON({
  [defaultExport]: DefaultExport,
  [emptyFile]: EmptyFile,
  [fullVueSFC]: FullVueSFC,
  [jsBasics]: JSBasics,
  [reactComponent]: ReactComponent,
  [vueSFCOnlyJS]: VueSFCOnlyJS,
});
export const fsMock = createFsFromVolume(volume);
