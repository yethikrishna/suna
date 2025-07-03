import React, { useEffect, useState } from "react";
import { Admin, DataProvider, Resource } from "react-admin";
import dataProvider from "./data-provider/graphqlDataProvider";
import { theme } from "./theme/theme";
import Login from "./Login";
import "./App.scss";
import Dashboard from "./pages/Dashboard";
import { AgentList } from "./agent/AgentList";
import { AgentCreate } from "./agent/AgentCreate";
import { AgentEdit } from "./agent/AgentEdit";
import { AgentShow } from "./agent/AgentShow";
import { TaskList } from "./task/TaskList";
import { TaskCreate } from "./task/TaskCreate";
import { TaskEdit } from "./task/TaskEdit";
import { TaskShow } from "./task/TaskShow";
import { MemoryLogList } from "./memoryLog/MemoryLogList";
import { MemoryLogCreate } from "./memoryLog/MemoryLogCreate";
import { MemoryLogEdit } from "./memoryLog/MemoryLogEdit";
import { MemoryLogShow } from "./memoryLog/MemoryLogShow";
import { PluginList } from "./plugin/PluginList";
import { PluginCreate } from "./plugin/PluginCreate";
import { PluginEdit } from "./plugin/PluginEdit";
import { PluginShow } from "./plugin/PluginShow";
import { IntegrationList } from "./integration/IntegrationList";
import { IntegrationCreate } from "./integration/IntegrationCreate";
import { IntegrationEdit } from "./integration/IntegrationEdit";
import { IntegrationShow } from "./integration/IntegrationShow";
import { SessionList } from "./session/SessionList";
import { SessionCreate } from "./session/SessionCreate";
import { SessionEdit } from "./session/SessionEdit";
import { SessionShow } from "./session/SessionShow";
import { UserList } from "./user/UserList";
import { UserCreate } from "./user/UserCreate";
import { UserEdit } from "./user/UserEdit";
import { UserShow } from "./user/UserShow";
import { jwtAuthProvider } from "./auth-provider/ra-auth-jwt";

const App = (): React.ReactElement => {
  return (
    <div className="App">
      <Admin
        title={"Yeti AI Backend-1"}
        dataProvider={dataProvider}
        authProvider={jwtAuthProvider}
        theme={theme}
        dashboard={Dashboard}
        loginPage={Login}
      >
        <Resource
          name="Agent"
          list={AgentList}
          edit={AgentEdit}
          create={AgentCreate}
          show={AgentShow}
        />
        <Resource
          name="Task"
          list={TaskList}
          edit={TaskEdit}
          create={TaskCreate}
          show={TaskShow}
        />
        <Resource
          name="MemoryLog"
          list={MemoryLogList}
          edit={MemoryLogEdit}
          create={MemoryLogCreate}
          show={MemoryLogShow}
        />
        <Resource
          name="Plugin"
          list={PluginList}
          edit={PluginEdit}
          create={PluginCreate}
          show={PluginShow}
        />
        <Resource
          name="Integration"
          list={IntegrationList}
          edit={IntegrationEdit}
          create={IntegrationCreate}
          show={IntegrationShow}
        />
        <Resource
          name="Session"
          list={SessionList}
          edit={SessionEdit}
          create={SessionCreate}
          show={SessionShow}
        />
        <Resource
          name="User"
          list={UserList}
          edit={UserEdit}
          create={UserCreate}
          show={UserShow}
        />
      </Admin>
    </div>
  );
};

export default App;
