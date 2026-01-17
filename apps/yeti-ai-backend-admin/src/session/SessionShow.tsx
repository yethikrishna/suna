import * as React from "react";

import {
  Show,
  SimpleShowLayout,
  ShowProps,
  DateField,
  TextField,
  ReferenceField,
  ReferenceManyField,
  Datagrid,
} from "react-admin";

import { AGENT_TITLE_FIELD } from "../agent/AgentTitle";
import { SESSION_TITLE_FIELD } from "./SessionTitle";
import { USER_TITLE_FIELD } from "../user/UserTitle";

export const SessionShow = (props: ShowProps): React.ReactElement => {
  return (
    <Show {...props}>
      <SimpleShowLayout>
        <DateField source="createdAt" label="Created At" />
        <TextField label="endTime" source="endTime" />
        <TextField label="ID" source="id" />
        <TextField label="startTime" source="startTime" />
        <DateField source="updatedAt" label="Updated At" />
        <ReferenceField label="User" source="user.id" reference="User">
          <TextField source={USER_TITLE_FIELD} />
        </ReferenceField>
        <ReferenceManyField
          reference="MemoryLog"
          target="sessionId"
          label="MemoryLogs"
        >
          <Datagrid rowClick="show" bulkActionButtons={false}>
            <ReferenceField label="Agent" source="agent.id" reference="Agent">
              <TextField source={AGENT_TITLE_FIELD} />
            </ReferenceField>
            <TextField label="content" source="content" />
            <DateField source="createdAt" label="Created At" />
            <TextField label="ID" source="id" />
            <TextField label="relatedTask" source="relatedTask" />
            <ReferenceField
              label="Session"
              source="session.id"
              reference="Session"
            >
              <TextField source={SESSION_TITLE_FIELD} />
            </ReferenceField>
            <TextField label="timestamp" source="timestamp" />
            <TextField label="type" source="typeField" />
            <DateField source="updatedAt" label="Updated At" />
          </Datagrid>
        </ReferenceManyField>
      </SimpleShowLayout>
    </Show>
  );
};
