// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { Link, Typography } from "@mui/material";
import { useSnackbar } from "notistack";
import { extname } from "path";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { makeStyles } from "tss-react/mui";

import Logger from "@foxglove/log";
import { AppSetting } from "@foxglove/studio-base/AppSetting";
import AccountSettings from "@foxglove/studio-base/components/AccountSettingsSidebar/AccountSettings";
import { AppBar } from "@foxglove/studio-base/components/AppBar";
import { CustomWindowControlsProps } from "@foxglove/studio-base/components/AppBar/CustomWindowControls";
import {
  DataSourceDialog,
  DataSourceDialogItem,
} from "@foxglove/studio-base/components/DataSourceDialog";
import { DataSourceSidebar } from "@foxglove/studio-base/components/DataSourceSidebar";
import { EventsList } from "@foxglove/studio-base/components/DataSourceSidebar/EventsList";
import { TopicList } from "@foxglove/studio-base/components/DataSourceSidebar/TopicList";
import DocumentDropListener from "@foxglove/studio-base/components/DocumentDropListener";
import ExtensionsSettings from "@foxglove/studio-base/components/ExtensionsSettings";
import KeyListener from "@foxglove/studio-base/components/KeyListener";
import LayoutBrowser from "@foxglove/studio-base/components/LayoutBrowser";
import {
  MessagePipelineContext,
  useMessagePipeline,
  useMessagePipelineGetter,
} from "@foxglove/studio-base/components/MessagePipeline";
import MultiProvider from "@foxglove/studio-base/components/MultiProvider";
import PanelLayout from "@foxglove/studio-base/components/PanelLayout";
import PanelList from "@foxglove/studio-base/components/PanelList";
import PanelSettings from "@foxglove/studio-base/components/PanelSettings";
import PlaybackControls from "@foxglove/studio-base/components/PlaybackControls";
import { ProblemsList } from "@foxglove/studio-base/components/ProblemsList";
import RemountOnValueChange from "@foxglove/studio-base/components/RemountOnValueChange";
import { SidebarContent } from "@foxglove/studio-base/components/SidebarContent";
import Sidebars, { SidebarItem } from "@foxglove/studio-base/components/Sidebars";
import { NewSidebarItem } from "@foxglove/studio-base/components/Sidebars/NewSidebar";
import { SignInFormModal } from "@foxglove/studio-base/components/SignInFormModal";
import Stack from "@foxglove/studio-base/components/Stack";
import {
  StudioLogsSettings,
  StudioLogsSettingsSidebar,
} from "@foxglove/studio-base/components/StudioLogsSettings";
import { SyncAdapters } from "@foxglove/studio-base/components/SyncAdapters";
import VariablesList from "@foxglove/studio-base/components/VariablesList";
import { WorkspaceDialogs } from "@foxglove/studio-base/components/WorkspaceDialogs";
import { useAppContext } from "@foxglove/studio-base/context/AppContext";
import {
  LayoutState,
  useCurrentLayoutSelector,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { useCurrentUser } from "@foxglove/studio-base/context/CurrentUserContext";
import { EventsStore, useEvents } from "@foxglove/studio-base/context/EventsContext";
import { useExtensionCatalog } from "@foxglove/studio-base/context/ExtensionCatalogContext";
import { useNativeAppMenu } from "@foxglove/studio-base/context/NativeAppMenuContext";
import { usePlayerSelection } from "@foxglove/studio-base/context/PlayerSelectionContext";
import {
  LeftSidebarItemKey,
  RightSidebarItemKey,
  SidebarItemKey,
  SidebarItemKeys,
  WorkspaceContextStore,
  useWorkspaceStore,
} from "@foxglove/studio-base/context/Workspace/WorkspaceContext";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks";
import useAddPanel from "@foxglove/studio-base/hooks/useAddPanel";
import { useDefaultWebLaunchPreference } from "@foxglove/studio-base/hooks/useDefaultWebLaunchPreference";
import useElectronFilesToOpen from "@foxglove/studio-base/hooks/useElectronFilesToOpen";
import { useInitialDeepLinkState } from "@foxglove/studio-base/hooks/useInitialDeepLinkState";
import useNativeAppMenuEvent from "@foxglove/studio-base/hooks/useNativeAppMenuEvent";
import { PlayerPresence } from "@foxglove/studio-base/players/types";
import { PanelStateContextProvider } from "@foxglove/studio-base/providers/PanelStateContextProvider";
import WorkspaceContextProvider from "@foxglove/studio-base/providers/WorkspaceContextProvider";
import ICONS from "@foxglove/studio-base/theme/icons";
import isDesktopApp from "@foxglove/studio-base/util/isDesktopApp";

import { useWorkspaceActions } from "./context/Workspace/useWorkspaceActions";

const log = Logger.getLogger(__filename);

const useStyles = makeStyles()({
  container: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    flex: "1 1 100%",
    outline: "none",
    overflow: "hidden",
  },
});

const selectedLayoutIdSelector = (state: LayoutState) => state.selectedLayout?.id;

function activeElementIsInput() {
  return (
    document.activeElement instanceof HTMLInputElement ||
    document.activeElement instanceof HTMLTextAreaElement
  );
}

type InjectedSidebarItem = [SidebarItemKey, SidebarItem];
function isInjectedSidebarItem(
  item: [string, { iconName?: string; title: string }],
): item is InjectedSidebarItem {
  return (
    SidebarItemKeys.some((itemKey) => itemKey === item[0]) &&
    item[1].iconName != undefined &&
    Object.keys(ICONS).includes(item[1].iconName)
  );
}

function keyboardEventHasModifier(event: KeyboardEvent) {
  if (navigator.userAgent.includes("Mac")) {
    return event.metaKey;
  } else {
    return event.ctrlKey;
  }
}

function AddPanel() {
  const addPanel = useAddPanel();
  const { openLayoutBrowser } = useWorkspaceActions();
  const selectedLayoutId = useCurrentLayoutSelector(selectedLayoutIdSelector);
  const { t } = useTranslation("addPanel");

  return (
    <SidebarContent disablePadding={selectedLayoutId != undefined} title={t("addPanel")}>
      {selectedLayoutId == undefined ? (
        <Typography color="text.secondary">
          <Trans
            t={t}
            i18nKey="noLayoutSelected"
            components={{
              selectLayoutLink: <Link onClick={openLayoutBrowser} />,
            }}
          />
        </Typography>
      ) : (
        <PanelList onPanelSelect={addPanel} />
      )}
    </SidebarContent>
  );
}

function ExtensionsSidebar() {
  return (
    <SidebarContent title="Extensions" disablePadding>
      <ExtensionsSettings />
    </SidebarContent>
  );
}

type WorkspaceProps = CustomWindowControlsProps & {
  deepLinks?: string[]; // eslint-disable-line react/no-unused-prop-types
  appBarLeftInset?: number;
  onAppBarDoubleClick?: () => void;
};

const DEFAULT_DEEPLINKS = Object.freeze([]);

const selectPlayerPresence = ({ playerState }: MessagePipelineContext) => playerState.presence;
const selectPlayerIsPresent = ({ playerState }: MessagePipelineContext) =>
  playerState.presence !== PlayerPresence.NOT_PRESENT;
const selectPlayerProblems = ({ playerState }: MessagePipelineContext) => playerState.problems;
const selectIsPlaying = (ctx: MessagePipelineContext) =>
  ctx.playerState.activeData?.isPlaying === true;
const selectPause = (ctx: MessagePipelineContext) => ctx.pausePlayback;
const selectPlay = (ctx: MessagePipelineContext) => ctx.startPlayback;
const selectSeek = (ctx: MessagePipelineContext) => ctx.seekPlayback;
const selectPlayUntil = (ctx: MessagePipelineContext) => ctx.playUntil;
const selectPlayerId = (ctx: MessagePipelineContext) => ctx.playerState.playerId;
const selectEventsSupported = (store: EventsStore) => store.eventsSupported;

const selectWorkspaceDataSourceDialog = (store: WorkspaceContextStore) => store.dialogs.dataSource;
const selectWorkspaceSidebarItem = (store: WorkspaceContextStore) => store.sidebars.legacy.item;
const selectWorkspaceLeftSidebarItem = (store: WorkspaceContextStore) => store.sidebars.left.item;
const selectWorkspaceLeftSidebarOpen = (store: WorkspaceContextStore) => store.sidebars.left.open;
const selectWorkspaceLeftSidebarSize = (store: WorkspaceContextStore) => store.sidebars.left.size;
const selectWorkspaceRightSidebarItem = (store: WorkspaceContextStore) => store.sidebars.right.item;
const selectWorkspaceRightSidebarOpen = (store: WorkspaceContextStore) => store.sidebars.right.open;
const selectWorkspaceRightSidebarSize = (store: WorkspaceContextStore) => store.sidebars.right.size;

type WorkspaceContentProps = WorkspaceProps & { showSignInForm: boolean };

function WorkspaceContent(props: WorkspaceContentProps): JSX.Element {
  const { classes } = useStyles();
  const containerRef = useRef<HTMLDivElement>(ReactNull);
  const { availableSources, selectSource } = usePlayerSelection();
  const playerPresence = useMessagePipeline(selectPlayerPresence);
  const playerProblems = useMessagePipeline(selectPlayerProblems);

  const sidebarItem = useWorkspaceStore(selectWorkspaceSidebarItem);
  const dataSourceDialog = useWorkspaceStore(selectWorkspaceDataSourceDialog);
  const leftSidebarItem = useWorkspaceStore(selectWorkspaceLeftSidebarItem);
  const leftSidebarOpen = useWorkspaceStore(selectWorkspaceLeftSidebarOpen);
  const leftSidebarSize = useWorkspaceStore(selectWorkspaceLeftSidebarSize);
  const rightSidebarItem = useWorkspaceStore(selectWorkspaceRightSidebarItem);
  const rightSidebarOpen = useWorkspaceStore(selectWorkspaceRightSidebarOpen);
  const rightSidebarSize = useWorkspaceStore(selectWorkspaceRightSidebarSize);

  const { dialogActions, sidebarActions } = useWorkspaceActions();

  // file types we support for drag/drop
  const allowedDropExtensions = useMemo(() => {
    const extensions = [".foxe"];
    for (const source of availableSources) {
      if (source.type === "file" && source.supportedFileTypes) {
        extensions.push(...source.supportedFileTypes);
      }
    }
    return extensions;
  }, [availableSources]);

  // We use playerId to detect when a player changes for RemountOnValueChange below
  // see comment below above the RemountOnValueChange component
  const playerId = useMessagePipeline(selectPlayerId);

  const { currentUser, signIn } = useCurrentUser();
  const supportsAccountSettings = signIn != undefined;

  useDefaultWebLaunchPreference();

  const [enableStudioLogsSidebar = false] = useAppConfigurationValue<boolean>(
    AppSetting.SHOW_DEBUG_PANELS,
  );
  // Since we can't toggle the title bar on an electron window, keep the setting at its initial
  // value until the app is reloaded/relaunched.
  const [currentEnableNewTopNav = false] = useAppConfigurationValue<boolean>(
    AppSetting.ENABLE_NEW_TOPNAV,
  );

  const [initialEnableNewTopNav] = useState(currentEnableNewTopNav);
  const enableNewTopNav = isDesktopApp() ? initialEnableNewTopNav : currentEnableNewTopNav;

  const { sidebarItems: appContextSidebarItems, workspaceExtensions } = useAppContext();

  // When a player is activated, hide the open dialog.
  useLayoutEffect(() => {
    if (
      playerPresence === PlayerPresence.PRESENT ||
      playerPresence === PlayerPresence.INITIALIZING
    ) {
      dialogActions.dataSource.close();
    }
  }, [dialogActions.dataSource, playerPresence]);

  useEffect(() => {
    // Focus on page load to enable keyboard interaction.
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, []);

  useNativeAppMenuEvent(
    "open-layouts",
    useCallback(() => {
      sidebarActions.legacy.selectItem("layouts");
    }, [sidebarActions.legacy]),
  );

  useNativeAppMenuEvent(
    "open-add-panel",
    useCallback(() => {
      sidebarActions.legacy.selectItem("add-panel");
    }, [sidebarActions.legacy]),
  );

  useNativeAppMenuEvent(
    "open-panel-settings",
    useCallback(() => {
      sidebarActions.legacy.selectItem("panel-settings");
    }, [sidebarActions.legacy]),
  );

  useNativeAppMenuEvent(
    "open-variables",
    useCallback(() => {
      sidebarActions.legacy.selectItem("variables");
    }, [sidebarActions.legacy]),
  );

  useNativeAppMenuEvent(
    "open-extensions",
    useCallback(() => {
      sidebarActions.legacy.selectItem("extensions");
    }, [sidebarActions.legacy]),
  );

  useNativeAppMenuEvent(
    "open-account",
    useCallback(() => {
      sidebarActions.legacy.selectItem("account");
    }, [sidebarActions.legacy]),
  );

  useNativeAppMenuEvent(
    "open-app-settings",
    useCallback(() => {
      dialogActions.preferences.open();
    }, [dialogActions.preferences]),
  );

  useNativeAppMenuEvent(
    "open-file",
    useCallback(() => dialogActions.dataSource.open("file"), [dialogActions.dataSource]),
  );

  useNativeAppMenuEvent(
    "open-remote-file",
    useCallback(() => dialogActions.dataSource.open("remote"), [dialogActions.dataSource]),
  );

  useNativeAppMenuEvent(
    "open-sample-data",
    useCallback(() => dialogActions.dataSource.open("demo"), [dialogActions.dataSource]),
  );

  const nativeAppMenu = useNativeAppMenu();

  const connectionSources = useMemo(() => {
    return availableSources.filter((source) => source.type === "connection");
  }, [availableSources]);

  useEffect(() => {
    if (!nativeAppMenu) {
      return;
    }

    for (const item of connectionSources) {
      nativeAppMenu.addFileEntry(item.displayName, () => {
        dialogActions.dataSource.open("connection", item);
      });
    }

    return () => {
      for (const item of connectionSources) {
        nativeAppMenu.removeFileEntry(item.displayName);
      }
    };
  }, [connectionSources, dialogActions.dataSource, nativeAppMenu]);

  const { enqueueSnackbar } = useSnackbar();

  const installExtension = useExtensionCatalog((state) => state.installExtension);

  const openHandle = useCallback(
    async (
      handle: FileSystemFileHandle /* foxglove-depcheck-used: @types/wicg-file-system-access */,
    ) => {
      log.debug("open handle", handle);
      const file = await handle.getFile();

      if (file.name.endsWith(".foxe")) {
        // Extension installation
        try {
          const arrayBuffer = await file.arrayBuffer();
          const data = new Uint8Array(arrayBuffer);
          const extension = await installExtension("local", data);
          enqueueSnackbar(`Installed extension ${extension.id}`, { variant: "success" });
        } catch (err) {
          log.error(err);
          enqueueSnackbar(`Failed to install extension ${file.name}: ${err.message}`, {
            variant: "error",
          });
        }
      }

      // Look for a source that supports the file extensions
      const matchedSource = availableSources.find((source) => {
        const ext = extname(file.name);
        return source.supportedFileTypes?.includes(ext);
      });
      if (matchedSource) {
        selectSource(matchedSource.id, { type: "file", handle });
      }
    },
    [availableSources, enqueueSnackbar, installExtension, selectSource],
  );

  const openFiles = useCallback(
    async (files: File[]) => {
      const otherFiles: File[] = [];
      log.debug("open files", files);

      for (const file of files) {
        if (file.name.endsWith(".foxe")) {
          // Extension installation
          try {
            const arrayBuffer = await file.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);
            const extension = await installExtension("local", data);
            enqueueSnackbar(`Installed extension ${extension.id}`, { variant: "success" });
          } catch (err) {
            log.error(err);
            enqueueSnackbar(`Failed to install extension ${file.name}: ${err.message}`, {
              variant: "error",
            });
          }
        } else {
          otherFiles.push(file);
        }
      }

      if (otherFiles.length > 0) {
        // Look for a source that supports the dragged file extensions
        for (const source of availableSources) {
          const filteredFiles = otherFiles.filter((file) => {
            const ext = extname(file.name);
            return source.supportedFileTypes?.includes(ext);
          });

          // select the first source that has files that match the supported extensions
          if (filteredFiles.length > 0) {
            selectSource(source.id, { type: "file", files: otherFiles });
            break;
          }
        }
      }
    },
    [availableSources, enqueueSnackbar, installExtension, selectSource],
  );

  // files the main thread told us to open
  const filesToOpen = useElectronFilesToOpen();
  useEffect(() => {
    if (filesToOpen) {
      void openFiles(Array.from(filesToOpen));
    }
  }, [filesToOpen, openFiles]);

  const dropHandler = useCallback(
    (event: { files?: File[]; handles?: FileSystemFileHandle[] }) => {
      const handle = event.handles?.[0];
      // When selecting sources with handles we can only select with a single handle since we haven't
      // written the code to store multiple handles for recents. When there are multiple handles, we
      // fall back to opening regular files.
      if (handle && event.handles?.length === 1) {
        void openHandle(handle);
      } else if (event.files) {
        void openFiles(event.files);
      }
    },
    [openFiles, openHandle],
  );

  // Since the _component_ field of a sidebar item entry is a component and accepts no additional
  // props we need to wrap our DataSourceSidebar component to connect the open data source action to
  // open the data source dialog.
  const DataSourceSidebarItem = useMemo(() => {
    return function DataSourceSidebarItemImpl() {
      return <DataSourceSidebar disableToolbar={enableNewTopNav} />;
    };
  }, [enableNewTopNav]);

  const PanelSettingsSidebar = useMemo(() => {
    return function PanelSettingsSidebarImpl() {
      return <PanelSettings disableToolbar />;
    };
  }, []);

  const { layoutBrowser: AppContextLayoutBrowser } = useAppContext();

  const [sidebarItems, sidebarBottomItems] = useMemo(() => {
    const topItems = new Map<SidebarItemKey, SidebarItem>([
      [
        "connection",
        {
          iconName: "DatabaseSettings",
          title: "Data source",
          component: DataSourceSidebarItem,
          badge:
            playerProblems && playerProblems.length > 0
              ? { count: playerProblems.length }
              : undefined,
        },
      ],
    ]);

    if (!enableNewTopNav) {
      topItems.set("layouts", {
        iconName: "FiveTileGrid",
        title: "Layouts",
        component: AppContextLayoutBrowser ?? LayoutBrowser,
      });
      topItems.set("add-panel", {
        iconName: "RectangularClipping",
        title: "Add panel",
        component: AddPanel,
      });
    }
    topItems.set("panel-settings", {
      iconName: "PanelSettings",
      title: "Panel settings",
      component: PanelSettings,
    });
    if (!enableNewTopNav) {
      topItems.set("variables", {
        iconName: "Variable2",
        title: "Variables",
        component: VariablesList,
      });
      topItems.set("extensions", {
        iconName: "AddIn",
        title: "Extensions",
        component: ExtensionsSidebar,
      });
    }
    if (enableStudioLogsSidebar) {
      topItems.set("studio-logs-settings", {
        iconName: "BacklogList",
        title: "Studio logs settings",
        component: StudioLogsSettingsSidebar,
      });
    }

    const bottomItems = new Map<SidebarItemKey, SidebarItem>([]);

    if (!enableNewTopNav) {
      if (supportsAccountSettings) {
        bottomItems.set("account", {
          iconName: currentUser != undefined ? "BlockheadFilled" : "Blockhead",
          title: currentUser != undefined ? `Signed in as ${currentUser.email}` : "Account",
          component: AccountSettings,
        });
      }

      for (const item of appContextSidebarItems ?? []) {
        if (isInjectedSidebarItem(item)) {
          bottomItems.set(item[0], item[1]);
        }
      }

      bottomItems.set("app-settings", {
        iconName: "Settings",
        title: "Settings",
      });
    }

    return [topItems, bottomItems];
  }, [
    DataSourceSidebarItem,
    playerProblems,
    enableNewTopNav,
    enableStudioLogsSidebar,
    AppContextLayoutBrowser,
    supportsAccountSettings,
    currentUser,
    appContextSidebarItems,
  ]);

  const eventsSupported = useEvents(selectEventsSupported);
  const showEventsTab = currentUser != undefined && eventsSupported;

  const leftSidebarItems = useMemo(() => {
    const items = new Map<LeftSidebarItemKey, NewSidebarItem>([
      ["panel-settings", { title: "Panel", component: PanelSettingsSidebar }],
      ["topics", { title: "Topics", component: TopicList }],
      [
        "problems",
        {
          title: "Problems",
          component: ProblemsList,
          badge:
            playerProblems && playerProblems.length > 0
              ? {
                  count: playerProblems.length,
                  color: "error",
                }
              : undefined,
        },
      ],
    ]);
    return items;
  }, [PanelSettingsSidebar, playerProblems]);

  const rightSidebarItems = useMemo(() => {
    const items = new Map<RightSidebarItemKey, NewSidebarItem>([
      ["variables", { title: "Variables", component: VariablesList }],
    ]);
    if (enableStudioLogsSidebar) {
      items.set("studio-logs-settings", { title: "Studio Logs", component: StudioLogsSettings });
    }
    if (showEventsTab) {
      items.set("events", { title: "Events", component: EventsList });
    }
    return items;
  }, [enableStudioLogsSidebar, showEventsTab]);

  const keyDownHandlers = useMemo(() => {
    return {
      b: (ev: KeyboardEvent) => {
        if (!keyboardEventHasModifier(ev) || activeElementIsInput() || sidebarItem == undefined) {
          return;
        }

        ev.preventDefault();
        sidebarActions.legacy.selectItem(undefined);
      },
      "[": () => sidebarActions.left.setOpen((oldValue) => !oldValue),
      "]": () => sidebarActions.right.setOpen((oldValue) => !oldValue),
    };
  }, [sidebarActions.left, sidebarActions.legacy, sidebarActions.right, sidebarItem]);

  const play = useMessagePipeline(selectPlay);
  const playUntil = useMessagePipeline(selectPlayUntil);
  const pause = useMessagePipeline(selectPause);
  const seek = useMessagePipeline(selectSeek);
  const isPlaying = useMessagePipeline(selectIsPlaying);
  const getMessagePipeline = useMessagePipelineGetter();
  const getTimeInfo = useCallback(
    () => getMessagePipeline().playerState.activeData ?? {},
    [getMessagePipeline],
  );

  return (
    <MultiProvider
      providers={[
        /* eslint-disable react/jsx-key */
        <PanelStateContextProvider />,
        /* eslint-enable react/jsx-key */
      ]}
    >
      {props.showSignInForm && <SignInFormModal />}
      {dataSourceDialog.open && <DataSourceDialog />}
      <DocumentDropListener onDrop={dropHandler} allowedExtensions={allowedDropExtensions} />
      <SyncAdapters />
      <KeyListener global keyDownHandlers={keyDownHandlers} />
      <div className={classes.container} ref={containerRef} tabIndex={0}>
        {enableNewTopNav && (
          <AppBar
            leftInset={props.appBarLeftInset}
            onDoubleClick={props.onAppBarDoubleClick}
            showCustomWindowControls={props.showCustomWindowControls}
            isMaximized={props.isMaximized}
            onMinimizeWindow={props.onMinimizeWindow}
            onMaximizeWindow={props.onMaximizeWindow}
            onUnmaximizeWindow={props.onUnmaximizeWindow}
            onCloseWindow={props.onCloseWindow}
          />
        )}
        <Sidebars
          items={sidebarItems}
          bottomItems={sidebarBottomItems}
          selectedKey={sidebarItem}
          onSelectKey={sidebarActions.legacy.selectItem}
          leftItems={leftSidebarItems}
          selectedLeftKey={leftSidebarOpen ? leftSidebarItem : undefined}
          onSelectLeftKey={sidebarActions.left.selectItem}
          leftSidebarSize={leftSidebarSize}
          setLeftSidebarSize={sidebarActions.left.setSize}
          rightItems={rightSidebarItems}
          selectedRightKey={rightSidebarOpen ? rightSidebarItem : undefined}
          onSelectRightKey={sidebarActions.right.selectItem}
          rightSidebarSize={rightSidebarSize}
          setRightSidebarSize={sidebarActions.right.setSize}
        >
          {/* To ensure no stale player state remains, we unmount all panels when players change */}
          <RemountOnValueChange value={playerId}>
            <Stack>
              <PanelLayout />
            </Stack>
          </RemountOnValueChange>
        </Sidebars>
        {play && pause && seek && (
          <div style={{ flexShrink: 0 }}>
            <PlaybackControls
              play={play}
              pause={pause}
              seek={seek}
              playUntil={playUntil}
              isPlaying={isPlaying}
              getTimeInfo={getTimeInfo}
            />
          </div>
        )}
      </div>
      {!props.showSignInForm && workspaceExtensions}
      <WorkspaceDialogs />
    </MultiProvider>
  );
}

export default function Workspace(props: WorkspaceProps): JSX.Element {
  const [showOpenDialogOnStartup = true] = useAppConfigurationValue<boolean>(
    AppSetting.SHOW_OPEN_DIALOG_ON_STARTUP,
  );

  const { currentUser } = useCurrentUser();

  const { currentUserRequired } = useInitialDeepLinkState(props.deepLinks ?? DEFAULT_DEEPLINKS);

  const isPlayerPresent = useMessagePipeline(selectPlayerIsPresent);

  const showSignInForm = currentUserRequired && currentUser == undefined;

  const initialItem: undefined | DataSourceDialogItem =
    isPlayerPresent || !showOpenDialogOnStartup || showSignInForm ? undefined : "start";

  const initialState: Pick<WorkspaceContextStore, "dialogs"> = {
    dialogs: {
      dataSource: {
        activeDataSource: undefined,
        open: initialItem != undefined,
        item: initialItem,
      },
      preferences: {
        initialTab: undefined,
        open: false,
      },
    },
  };

  return (
    <WorkspaceContextProvider initialState={initialState}>
      <WorkspaceContent showSignInForm={showSignInForm} {...props} />
    </WorkspaceContextProvider>
  );
}
