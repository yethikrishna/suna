import * as React from "react";
import {
  List,
  Datagrid,
  ListProps,
  TextField,
  DateField,
  BooleanField,
} from "react-admin";
import Pagination from "../Components/Pagination";

export const PluginList = (props: ListProps): React.ReactElement => {
  return (
    <List {...props} title={"Plugins"} perPage={50} pagination={<Pagination />}>
      <Datagrid rowClick="show" bulkActionButtons={false}>
        <TextField label="config" source="configField" />
        <DateField source="createdAt" label="Created At" />
        <TextField label="description" source="description" />
        <TextField label="ID" source="id" />
        <TextField label="name" source="name" />
        <BooleanField label="permissionRequired" source="permissionRequired" />
        <TextField label="status" source="status" />
        <DateField source="updatedAt" label="Updated At" />
        <TextField label="version" source="version" />{" "}
      </Datagrid>
    </List>
  );
};
