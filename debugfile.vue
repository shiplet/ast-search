<template>
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
    console.log('this', this.test)
  }
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
              workspace.id === store.state.casesDetails.app_workspace_id
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
          caseSubCreatedAt: `Created {date}`,
          caseSubCreatedBy: `Created by {name}`,
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
          name: `${caseSubDetails.value?.created_by?.first_name} ${caseSubDetails.value?.created_by?.last_name}`,
        })
      ),
      caseSubCreatedAt: computed(() =>
        t("caseSubCreatedAt", {
          date: formatDateToDayMonthShortYear(caseSubDetails.value.created_at),
        })
      ),
      assigneeUpdated: computed(() => t("assignee.updated", this.test)),
      statusUpdated: computed(() => t("statusUpdated")),
    };
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
        (ws) => ws.id === workspaceQuery
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
        }
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
            name: `${account.first_name} ${account.last_name}`,
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
        (user) => user.id === this.casesDetails.assignee_id
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
              "NATIONAL"
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
            error.response.data.detail || error.response.data.assignee_id
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
