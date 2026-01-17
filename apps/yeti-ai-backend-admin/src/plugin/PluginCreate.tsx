import * as React from "react";
import {
  Create,
  SimpleForm,
  CreateProps,
  TextInput,
  BooleanInput,
  SelectInput,
} from "react-admin";

export const PluginCreate = (props: CreateProps): React.ReactElement => {
  return (
    <Create {...props}>
      <SimpleForm>
        <div />
        <TextInput label="description" multiline source="description" />
        <TextInput label="name" source="name" />
        <BooleanInput label="permissionRequired" source="permissionRequired" />
        <SelectInput
          source="status"
          label="status"
          choices={[{ label: "Option 1", value: "Option1" }]}
          optionText="label"
          allowEmpty
          optionValue="value"
        />
        <TextInput label="version" source="version" />
      </SimpleForm>
    </Create>
  );
};
