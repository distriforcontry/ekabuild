"use client";
import * as THREE from "three";
import { formatBytes } from "@eka/shared";
import type { Translator } from "@/i18n/core";
import type { Engine } from "./engine";
import { downloadBlob, fmtInt, fmtM, fmtM2, fmtNum, slugify } from "./scene-utils";

type T = Translator["t"];

export function statsRows(engine: Engine, t: T): [string, string][] {
  const info = engine.info;
  const st = engine.stats();
  if (!info || !st) return [];
  return [
    [t("studio.scene.name"), info.name],
    [t("studio.scene.format"), info.format.toUpperCase()],
    [t("studio.scene.size"), formatBytes(info.fileSize)],
    [t("studio.scene.loadTime"), `${fmtInt(info.downloadMs)} ms`],
    [t("studio.scene.parseTime"), `${fmtInt(info.parseMs)} ms`],
    [t("studio.scene.generator"), info.generator ?? "—"],
    [t("studio.scene.version"), info.version ?? "—"],
    [t("studio.scene.nodes"), fmtInt(st.nodes)],
    [t("studio.scene.groups"), fmtInt(st.groups)],
    [t("studio.scene.meshes"), fmtInt(st.meshes)],
    [t("studio.scene.triangles"), fmtInt(st.triangles)],
    [t("studio.scene.vertices"), fmtInt(st.vertices)],
    [t("studio.scene.drawCalls"), fmtInt(st.drawCalls)],
    [t("studio.scene.materials"), fmtInt(st.materials)],
    [t("studio.scene.textures"), fmtInt(st.textures)],
    [t("studio.scene.textureMem"), formatBytes(st.textureBytes)],
    [t("studio.scene.geometryMem"), formatBytes(st.geometryBytes)],
    [t("studio.scene.animations"), fmtInt(info.animations.length)],
    [t("studio.scene.lights"), fmtInt(st.lights)],
    [t("studio.scene.hidden"), fmtInt(st.hidden)],
    [t("studio.scene.sizeX"), fmtM(st.size[0])],
    [t("studio.scene.sizeY"), fmtM(st.size[1])],
    [t("studio.scene.sizeZ"), fmtM(st.size[2])],
    [t("studio.scene.footprint"), fmtM2(st.footprint)],
    [
      t("studio.scene.building"),
      st.buildingSize ? `${fmtNum(st.buildingSize[0], 1)} × ${fmtNum(st.buildingSize[2], 1)} × ${fmtNum(st.buildingSize[1], 1)} m` : "—",
    ],
    [t("studio.scene.floors"), fmtInt(st.floors)],
    [t("studio.scene.typicalFloor"), st.typicalFloorHeight ? fmtM(st.typicalFloorHeight) : "—"],
    [t("studio.scene.extensions"), info.extensions.join(" ") || "—"],
  ];
}

export function downloadStatsCsv(engine: Engine, t: T) {
  const rows = statsRows(engine, t);
  if (!rows.length) return;
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const floors = engine.floors();
  const lines = ["key,value", ...rows.map(([k, v]) => `${esc(k)},${esc(v)}`)];
  if (floors.length) {
    lines.push("", "floor,name,elevation_m,height_m,floor_to_floor_m,triangles,meshes");
    for (const f of floors)
      lines.push([f.n, esc(f.name), f.elevation.toFixed(3), f.height.toFixed(3), f.step?.toFixed(3) ?? "", f.triangles, f.meshes].join(","));
  }
  downloadBlob(new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" }), `${slugify(engine.info?.name ?? "model")}-stats.csv`);
}

export function downloadNotesJson(engine: Engine) {
  const { measures, areas, pins } = engine.store.get();
  const v = (a: number[]) => new THREE.Vector3(a[0], a[1], a[2]);
  const name = engine.info?.name ?? "model";
  const data = {
    app: "EKA BUILD 3D Studio",
    model: { name, key: engine.key },
    exportedAt: new Date().toISOString(),
    units: "m",
    measures: measures.map((m) => ({ id: m.id, a: m.a, b: m.b, distance: Number(v(m.a).distanceTo(v(m.b)).toFixed(4)) })),
    areas: areas.map((a) => ({
      id: a.id,
      area: Number(a.area.toFixed(4)),
      point: a.point,
      normal: a.normal,
      orientation: a.label === "h" ? "horizontal" : "vertical",
    })),
    pins: pins.map((p) => ({ id: p.id, n: p.n, text: p.text, position: p.position, normal: p.normal })),
  };
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), `${slugify(name)}-notes.json`);
}

export function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}
