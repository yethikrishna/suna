import * as React from "react";
import {
  Edit,
  SimpleForm,
  EditProps,
  TextInput,
  BooleanInput,
  SelectInput,
} from "react-admin";

export const PluginEdit = (props: EditProps): React.ReactElement => {
  return (
    <Edit {...props}>
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
    </Edit>
  );
};
