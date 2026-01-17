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

export const TaskList = (props: ListProps): React.ReactElement => {
  return (
    <List {...props} title={"Tasks"} perPage={50} pagination={<Pagination />}>
      <Datagrid rowClick="show" bulkActionButtons={false}>
        <ReferenceField label="Agent" source="agent.id" reference="Agent">
          <TextField source={AGENT_TITLE_FIELD} />
        </ReferenceField>
        <DateField source="createdAt" label="Created At" />
        <TextField label="description" source="description" />
        <TextField label="ID" source="id" />
        <TextField label="output" source="output" />
        <TextField label="parentTask" source="parentTask" />
        <TextField label="relatedSession" source="relatedSession" />
        <TextField label="scheduledTime" source="scheduledTime" />
        <TextField label="status" source="status" />
        <TextField label="title" source="title" />
        <DateField source="updatedAt" label="Updated At" />{" "}
      </Datagrid>
    </List>
  );
};
