import { Agent } from "../agent/Agent";

export type Task = {
  agent?: Agent | null;
  createdAt: Date;
  description: string | null;
  id: string;
  output: string | null;
  parentTask: string | null;
  relatedSession: string | null;
  scheduledTime: Date | null;
  status?: "Option1" | null;
  title: string | null;
  updatedAt: Date;
};
