// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Meta, StoryObj } from "@storybook/react";
import { userEvent, within } from "@storybook/testing-library";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import { ros2humble } from "@foxglove/rosmsg-msgs-common";
import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import { PlayerCapabilities, TopicStats } from "@foxglove/studio-base/players/types";

import { TopicList } from "./TopicList";

const topics = [
  { name: "/topic_1", schemaName: "std_msgs/String" },
  { name: "/topic_2", schemaName: "std_msgs/String" },
];

const topicStats = new Map<string, TopicStats>([
  [
    "/topic_1",
    {
      numMessages: 1234,
      firstMessageTime: { sec: 1, nsec: 0 },
      lastMessageTime: { sec: 2, nsec: 0 },
    },
  ],
  [
    "/topic_2",
    {
      numMessages: 3456,
      firstMessageTime: { sec: 1, nsec: 0 },
      lastMessageTime: { sec: 2, nsec: 0 },
    },
  ],
]);

export default {
  title: "components/TopicList",
  args: {
    capabilities: [PlayerCapabilities.playbackControl],
    topics,
    datatypes: new Map(Object.entries(ros2humble)),
    topicStats,
  },
  render: (args) => (
    <DndProvider backend={HTML5Backend}>
      <MockMessagePipelineProvider {...args}>
        <TopicList />
      </MockMessagePipelineProvider>
    </DndProvider>
  ),
} as Meta<typeof MockMessagePipelineProvider>;

type Story = StoryObj<typeof MockMessagePipelineProvider>;

export const Default: Story = {};

export const Empty: Story = {
  args: { topics: [] },
};
export const EmptyChinese: Story = {
  args: { topics: [] },
  parameters: { forceLanguage: "zh" },
};
export const EmptyJapanese: Story = {
  args: { topics: [] },
  parameters: { forceLanguage: "ja" },
};

export const FilterByTopicName: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const filterInputs = await canvas.findAllByTestId("topic-filter");

    for (const input of filterInputs) {
      await userEvent.type(input, "/topic_1");
    }
  },
};

export const FilterBySchemaName: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const filterInputs = await canvas.findAllByTestId("topic-filter");

    for (const input of filterInputs) {
      await userEvent.type(input, "std_msgs/String");
    }
  },
};

export const FilterByFieldName: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const filterInputs = await canvas.findAllByTestId("topic-filter");

    for (const input of filterInputs) {
      await userEvent.type(input, "data");
    }
  },
};

export const FilterByMessagePath: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const filterInputs = await canvas.findAllByTestId("topic-filter");

    for (const input of filterInputs) {
      await userEvent.type(input, "to1da");
    }
  },
};

export const FilterTextCleared: Story = {
  play: async ({ canvasElement }) => {
    const user = userEvent.setup();
    const canvas = within(canvasElement);
    const filterInputs = await canvas.findAllByTestId("topic-filter");

    for (const input of filterInputs) {
      await user.type(input, "/topic_1");
    }

    const clearButtons = await canvas.findAllByTitle("Clear filter");

    for (const button of clearButtons) {
      await user.click(button);
    }
  },
};

export const NoResults: Story = {
  play: async ({ canvasElement }) => {
    const user = userEvent.setup();
    const canvas = within(canvasElement);
    const filterInputs = await canvas.findAllByTestId("topic-filter");
    for (const input of filterInputs) {
      await user.type(input, "asdfasdf");
    }
  },
};

export const NoResultsChinese: Story = {
  ...NoResults,
  parameters: { forceLanguage: "zh" },
};
export const NoResultsJapanese: Story = {
  ...NoResults,
  parameters: { forceLanguage: "ja" },
};
