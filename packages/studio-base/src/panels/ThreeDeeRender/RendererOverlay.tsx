// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Ruler24Filled } from "@fluentui/react-icons";
import {
  Button,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  useTheme,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLongPress } from "react-use";
import { makeStyles } from "tss-react/mui";

import { LayoutActions } from "@foxglove/studio";
import PublishGoalIcon from "@foxglove/studio-base/components/PublishGoalIcon";
import PublishPointIcon from "@foxglove/studio-base/components/PublishPointIcon";
import PublishPoseEstimateIcon from "@foxglove/studio-base/components/PublishPoseEstimateIcon";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

import { InteractionContextMenu, Interactions, SelectionObject, TabType } from "./Interactions";
import type { PickedRenderable } from "./Picker";
import { Renderable } from "./Renderable";
import { useRenderer, useRendererEvent } from "./RendererContext";
import { Stats } from "./Stats";
import { MouseEventObject } from "./camera";
import { PublishClickType } from "./renderables/PublishClickTool";
import { InterfaceMode } from "./types";

const PublishClickIcons: Record<PublishClickType, React.ReactNode> = {
  pose: <PublishGoalIcon fontSize="inherit" />,
  point: <PublishPointIcon fontSize="inherit" />,
  pose_estimate: <PublishPoseEstimateIcon fontSize="inherit" />,
};

const useStyles = makeStyles()((theme) => ({
  iconButton: {
    position: "relative",
    fontSize: "1rem !important",
    pointerEvents: "auto",
    aspectRatio: "1",

    "& svg:not(.MuiSvgIcon-root)": {
      fontSize: "1rem !important",
    },
  },
  rulerIcon: {
    transform: "rotate(45deg)",
  },
  threeDeeButton: {
    fontFamily: fonts.MONOSPACE,
    fontFeatureSettings: theme.typography.caption.fontFeatureSettings,
    fontSize: theme.typography.caption.fontSize,
    fontWeight: theme.typography.fontWeightBold,
    lineHeight: "1em",
  },
  resetViewButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    marginBottom: theme.spacing(1),
    marginRight: theme.spacing(1),
  },
}));

/**
 * Provides DOM overlay elements on top of the 3D scene (e.g. stats, debug GUI).
 */
export function RendererOverlay(props: {
  interfaceMode: InterfaceMode;
  canvas: HTMLCanvasElement | ReactNull;
  addPanel: LayoutActions["addPanel"];
  enableStats: boolean;
  perspective: boolean;
  onTogglePerspective: () => void;
  measureActive: boolean;
  onClickMeasure: () => void;
  canPublish: boolean;
  publishActive: boolean;
  publishClickType: PublishClickType;
  onChangePublishClickType: (_: PublishClickType) => void;
  onClickPublish: () => void;
  timezone: string | undefined;
  /** Override default downloading behavior, used for Storybook */
  onDownload?: (blob: Blob, fileName: string) => void;
}): JSX.Element {
  const { t } = useTranslation("threeDee");
  const { classes } = useStyles();
  const [clickedPosition, setClickedPosition] = useState<{ clientX: number; clientY: number }>({
    clientX: 0,
    clientY: 0,
  });
  const [selectedRenderables, setSelectedRenderables] = useState<PickedRenderable[]>([]);
  const [selectedRenderable, setSelectedRenderable] = useState<PickedRenderable | undefined>(
    undefined,
  );
  const [interactionsTabType, setInteractionsTabType] = useState<TabType | undefined>(undefined);
  const renderer = useRenderer();

  // Toggle object selection mode on/off in the renderer
  useEffect(() => {
    if (renderer) {
      renderer.setPickingEnabled(interactionsTabType != undefined);
    }
  }, [interactionsTabType, renderer]);

  useRendererEvent("renderablesClicked", (selections, cursorCoords) => {
    const rect = props.canvas!.getBoundingClientRect();
    setClickedPosition({ clientX: rect.left + cursorCoords.x, clientY: rect.top + cursorCoords.y });
    setSelectedRenderables(selections);
    setSelectedRenderable(selections.length === 1 ? selections[0] : undefined);
  });

  const [showResetViewButton, setShowResetViewButton] = useState(renderer?.canResetView() ?? false);
  useRendererEvent(
    "resetViewChanged",
    useCallback(() => {
      setShowResetViewButton(renderer?.canResetView() ?? false);
    }, [renderer]),
  );
  const onResetView = useCallback(() => {
    renderer?.resetView();
  }, [renderer]);

  const stats = props.enableStats ? (
    <div id="stats" style={{ position: "absolute", top: "10px", left: "10px" }}>
      <Stats />
    </div>
  ) : undefined;

  // Convert the list of selected renderables (if any) into MouseEventObjects
  // that can be passed to <InteractionContextMenu>, which shows a context menu
  // of candidate objects to select
  const clickedObjects = useMemo<MouseEventObject[]>(
    () =>
      selectedRenderables.map((selection) => ({
        object: {
          pose: selection.renderable.pose,
          scale: selection.renderable.scale,
          color: undefined,
          interactionData: {
            topic: selection.renderable.name,
            highlighted: undefined,
            renderable: selection.renderable,
          },
        },
        instanceIndex: selection.instanceIndex,
      })),
    [selectedRenderables],
  );

  // Once a single renderable is selected, convert it to the SelectionObject
  // format to populate the object inspection dialog (<Interactions>)
  const selectedObject = useMemo<SelectionObject | undefined>(
    () =>
      selectedRenderable
        ? {
            object: {
              pose: selectedRenderable.renderable.pose,
              interactionData: {
                topic: selectedRenderable.renderable.topic,
                highlighted: true,
                downloader: selectedRenderable.renderable.getDownloader(),
                originalMessage: selectedRenderable.renderable.details(),
                instanceDetails:
                  selectedRenderable.instanceIndex != undefined
                    ? selectedRenderable.renderable.instanceDetails(
                        selectedRenderable.instanceIndex,
                      )
                    : undefined,
              },
            },
            instanceIndex: selectedRenderable.instanceIndex,
          }
        : undefined,
    [selectedRenderable],
  );

  // Inform the Renderer when a renderable is selected
  useEffect(() => {
    renderer?.setSelectedRenderable(selectedRenderable);
  }, [renderer, selectedRenderable]);

  const publickClickButtonRef = useRef<HTMLButtonElement>(ReactNull);
  const [publishMenuExpanded, setPublishMenuExpanded] = useState(false);
  const selectedPublishClickIcon = PublishClickIcons[props.publishClickType];

  const onLongPressPublish = useCallback(() => {
    setPublishMenuExpanded(true);
  }, []);
  const longPressPublishEvent = useLongPress(onLongPressPublish);

  const theme = useTheme();

  // Publish control is only available if the canPublish prop is true and we have a fixed frame in the renderer
  const showPublishControl =
    props.interfaceMode === "3d" && props.canPublish && renderer?.fixedFrameId != undefined;
  const publishControls = showPublishControl && (
    <>
      <IconButton
        {...longPressPublishEvent}
        color={props.publishActive ? "info" : "inherit"}
        title={props.publishActive ? "Click to cancel" : "Click to publish"}
        ref={publickClickButtonRef}
        onClick={props.onClickPublish}
        data-testid="publish-button"
        style={{ fontSize: "1rem", pointerEvents: "auto" }}
      >
        {selectedPublishClickIcon}
        <div
          style={{
            borderBottom: "6px solid currentColor",
            borderRight: "6px solid transparent",
            bottom: 0,
            left: 0,
            height: 0,
            width: 0,
            margin: theme.spacing(0.25),
            position: "absolute",
          }}
        />
      </IconButton>
      <Menu
        id="publish-menu"
        anchorEl={publickClickButtonRef.current}
        anchorOrigin={{ vertical: "top", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        open={publishMenuExpanded}
        onClose={() => setPublishMenuExpanded(false)}
      >
        <MenuItem
          selected={props.publishClickType === "pose_estimate"}
          onClick={() => {
            props.onChangePublishClickType("pose_estimate");
            setPublishMenuExpanded(false);
          }}
        >
          <ListItemIcon>{PublishClickIcons.pose_estimate}</ListItemIcon>
          <ListItemText>Publish pose estimate</ListItemText>
        </MenuItem>
        <MenuItem
          selected={props.publishClickType === "pose"}
          onClick={() => {
            props.onChangePublishClickType("pose");
            setPublishMenuExpanded(false);
          }}
        >
          <ListItemIcon>{PublishClickIcons.pose}</ListItemIcon>
          <ListItemText>Publish pose</ListItemText>
        </MenuItem>
        <MenuItem
          selected={props.publishClickType === "point"}
          onClick={() => {
            props.onChangePublishClickType("point");
            setPublishMenuExpanded(false);
          }}
        >
          <ListItemIcon>{PublishClickIcons.point}</ListItemIcon>
          <ListItemText>Publish point</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );

  const resetViewButton = showResetViewButton && (
    <Button
      className={classes.resetViewButton}
      variant="contained"
      color="secondary"
      onClick={onResetView}
      data-testid="reset-view"
    >
      {t("resetView")}
    </Button>
  );

  const { onDownload } = props;

  return (
    <>
      <div
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 10,
          pointerEvents: "none",
        }}
      >
        <Interactions
          onDownload={onDownload}
          addPanel={props.addPanel}
          selectedObject={selectedObject}
          interactionsTabType={interactionsTabType}
          setInteractionsTabType={setInteractionsTabType}
          timezone={props.timezone}
        />
        {props.interfaceMode === "3d" && (
          <Paper square={false} elevation={4} style={{ display: "flex", flexDirection: "column" }}>
            <IconButton
              className={classes.iconButton}
              color={props.perspective ? "info" : "inherit"}
              title={props.perspective ? "Switch to 2D camera" : "Switch to 3D camera"}
              onClick={props.onTogglePerspective}
            >
              <span className={classes.threeDeeButton}>3D</span>
            </IconButton>
            <IconButton
              data-testid="measure-button"
              className={classes.iconButton}
              color={props.measureActive ? "info" : "inherit"}
              title={props.measureActive ? "Cancel measuring" : "Measure distance"}
              onClick={props.onClickMeasure}
            >
              <Ruler24Filled className={classes.rulerIcon} />
            </IconButton>

            {publishControls}
          </Paper>
        )}
      </div>
      {clickedObjects.length > 1 && !selectedObject && (
        <InteractionContextMenu
          onClose={() => setSelectedRenderables([])}
          clickedPosition={clickedPosition}
          clickedObjects={clickedObjects}
          selectObject={(selection) => {
            if (selection) {
              const renderable = (
                selection.object as unknown as { interactionData: { renderable: Renderable } }
              ).interactionData.renderable;
              const instanceIndex = selection.instanceIndex;
              setSelectedRenderables([]);
              setSelectedRenderable({ renderable, instanceIndex });
            }
          }}
        />
      )}
      {stats}
      {resetViewButton}
    </>
  );
}
