import * as React from "react";
import {
  List,
  Datagrid,
  ListProps,
  ReferenceField,
  TextField,
  DateField,
} from "react-admin";
import Pagination from "../Components/Pagination";
import { AGENT_TITLE_FIELD } from "../agent/AgentTitle";
import { SESSION_TITLE_FIELD } from "../session/SessionTitle";

export const MemoryLogList = (props: ListProps): React.ReactElement => {
  return (
    <List
      {...props}
      title={"MemoryLogs"}
      perPage={50}
      pagination={<Pagination />}
    >
      <Datagrid rowClick="show" bulkActionButtons={false}>
        <ReferenceField label="Agent" source="agent.id" reference="Agent">
          <TextField source={AGENT_TITLE_FIELD} />
        </ReferenceField>
        <TextField label="content" source="content" />
        <DateField source="createdAt" label="Created At" />
        <TextField label="ID" source="id" />
        <TextField label="relatedTask" source="relatedTask" />
        <ReferenceField label="Session" source="session.id" reference="Session">
          <TextField source={SESSION_TITLE_FIELD} />
        </ReferenceField>
        <TextField label="timestamp" source="timestamp" />
        <TextField label="type" source="typeField" />
        <DateField source="updatedAt" label="Updated At" />{" "}
      </Datagrid>
    </List>
  );
};
