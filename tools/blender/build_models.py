"""
EKA BUILD — architectural demo models built in Blender (bpy 5.x).

    python -m venv .venv && .venv/bin/pip install bpy==5.2.2
    .venv/bin/python tools/blender/build_models.py [--models tower-twin,...] [--no-render] [--samples 48]

Outputs
  apps/api/prisma/assets/models/<name>.glb         web models (node convention: site, podium, floor-<n>, roof)
  apps/api/prisma/assets/renders/<name>-<view>.jpg Cycles renders (golden hour, Nishita/physical sky)
Afterwards run `node apps/web/scripts/optimize-models.mjs` to weld + quantise the GLBs.

Geometry is generated with bmesh (one mesh per storey, material slots per part) so it stays light enough
for the browser while carrying real architectural detail: bevelled slab edges, framed glazing panes, spandrels,
gold fins, cantilevered balconies with glass balustrades, lit interiors, landscaped site with roads and cars.
"""

import argparse
import math
import os
import random
import sys
import time

import bpy  # must be imported before bmesh / mathutils
import bmesh
from mathutils import Matrix, Vector

WEB_ONLY = False  # set when exporting GLB only; render-only helpers are skipped
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_MODELS = os.path.join(ROOT, "apps", "api", "prisma", "assets", "models")
OUT_RENDERS = os.path.join(ROOT, "apps", "api", "prisma", "assets", "renders")


# ───────────────────────────── scene & materials ─────────────────────────────


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    return scene


def principled(name, color, metallic=0.0, roughness=0.5, transmission=0.0, ior=1.45, emission=None, emission_strength=0.0, alpha=1.0, coat=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")

    def set_input(names, value):
        for n in names:
            if n in bsdf.inputs:
                bsdf.inputs[n].default_value = value
                return

    set_input(["Base Color"], (*color, 1.0))
    set_input(["Metallic"], metallic)
    set_input(["Roughness"], roughness)
    set_input(["Transmission Weight", "Transmission"], transmission)
    set_input(["IOR"], ior)
    set_input(["Coat Weight", "Clearcoat"], coat)
    if emission:
        set_input(["Emission Color", "Emission"], (*emission, 1.0))
        set_input(["Emission Strength"], emission_strength)
    if alpha < 1.0:
        set_input(["Alpha"], alpha)
        if hasattr(mat, "surface_render_method"):
            mat.surface_render_method = "BLENDED"
    mat.diffuse_color = (*color, alpha)
    return mat


def hex2rgb(h):
    h = h.lstrip("#")
    srgb = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    # Blender colour inputs are linear
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb)


def make_materials():
    return {
        "glass": principled("glass", hex2rgb("#a9c2d0"), metallic=0.0, roughness=0.02, transmission=1.0, ior=1.5),
        "glass_dark": principled("glass-dark", hex2rgb("#4a5a68"), metallic=0.0, roughness=0.03, transmission=0.85, ior=1.5),
        "gold": principled("gold-brushed", hex2rgb("#c9a464"), metallic=1.0, roughness=0.26),
        "stone": principled("stone-light", hex2rgb("#ece6d9"), roughness=0.62),
        "stone_warm": principled("stone-warm", hex2rgb("#d8c7a8"), roughness=0.7),
        "stone_dark": principled("stone-dark", hex2rgb("#2f3034"), roughness=0.55, metallic=0.05),
        "terracotta": principled("terracotta", hex2rgb("#b9775a"), roughness=0.72),
        "frame": principled("frame-alu", hex2rgb("#2b2d32"), metallic=0.85, roughness=0.32),
        "spandrel": principled("spandrel", hex2rgb("#3a3d44"), metallic=0.6, roughness=0.35),
        "railing": principled("balustrade-glass", hex2rgb("#cfe0e8"), roughness=0.02, transmission=1.0, ior=1.45),
        "interior": principled("interior", hex2rgb("#6e655a"), roughness=0.9),
        "ceiling_light": principled("interior-light", hex2rgb("#ffe7bf"), emission=hex2rgb("#ffc87a"), emission_strength=6.0, roughness=0.5),
        "accent_light": principled("accent-light", hex2rgb("#ffe2a8"), emission=hex2rgb("#ffcf86"), emission_strength=14.0),
        "wood": principled("wood-soffit", hex2rgb("#9a6b43"), roughness=0.55),
        "plaza": principled("plaza-stone", hex2rgb("#a59d90"), roughness=0.85),
        "asphalt": principled("asphalt", hex2rgb("#2a2a2c"), roughness=0.92),
        "marking": principled("road-marking", hex2rgb("#e9e5dc"), roughness=0.6),
        "curb": principled("curb", hex2rgb("#bdb7ab"), roughness=0.8),
        "grass": principled("grass", hex2rgb("#5b7a3c"), roughness=0.95),
        "foliage": principled("foliage", hex2rgb("#355a26"), roughness=0.9),
        "foliage2": principled("foliage-olive", hex2rgb("#5d6b2a"), roughness=0.9),
        "trunk": principled("bark", hex2rgb("#4e3a2a"), roughness=1.0),
        "water": principled("pool-water", hex2rgb("#2e7c95"), roughness=0.03, transmission=0.6, ior=1.33),
        "tile": principled("tile-turquoise", hex2rgb("#1f8fa3"), roughness=0.28, coat=0.6),
        "tile_blue": principled("tile-lapis", hex2rgb("#1b4f8f"), roughness=0.3, coat=0.5),
        "brick": principled("brick-ochre", hex2rgb("#c49a6c"), roughness=0.82),
        "car_paint": [principled(f"car-{i}", hex2rgb(c), metallic=0.6, roughness=0.22, coat=1.0) for i, c in enumerate(["#e9e9e9", "#1d1f24", "#7d8792", "#8c1d24", "#20406b", "#c9a464"])],
        "tyre": principled("tyre", hex2rgb("#151515"), roughness=0.8),
        "car_glass": principled("car-glass", hex2rgb("#1a2027"), metallic=0.2, roughness=0.05),
        "lamp_pole": principled("lamp-pole", hex2rgb("#1e1f22"), metallic=0.7, roughness=0.4),
        "play": principled("playground", hex2rgb("#d0643b"), roughness=0.6),
        "far_ground": principled("far-ground", hex2rgb("#6f6a60"), roughness=1.0),
    }


# ───────────────────────────── mesh builder ─────────────────────────────


class Builder:
    """Accumulates primitives into one bmesh with per-face material slots → one Blender object (= one glTF node)."""

    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.mats = []

    def _mi(self, mat):
        if mat not in self.mats:
            self.mats.append(mat)
        return self.mats.index(mat)

    def _finish(self, verts, mat, bevel=0.0, bevel_segments=2, vertical_only=False):
        mi = self._mi(mat)
        faces = set()
        for v in verts:
            faces.update(v.link_faces)
        if bevel > 0:
            edges = set()
            for v in verts:
                for e in v.link_edges:
                    if vertical_only:
                        a, b = e.verts
                        if abs(a.co.z - b.co.z) < 1e-6:
                            continue
                    edges.add(e)
            res = bmesh.ops.bevel(self.bm, geom=list(edges), offset=bevel, segments=bevel_segments, profile=0.5, affect="EDGES", clamp_overlap=True)
            faces.update(res["faces"])
            for v in verts:
                if v.is_valid:
                    faces.update(v.link_faces)
        for f in faces:
            if f.is_valid:
                f.material_index = mi

    def box(self, mat, sx, sy, sz, x, y, z, rot=0.0, bevel=0.0, segments=2, vertical_only=False):
        """Axis-aligned box; (x, y) centre, z = bottom."""
        m = Matrix.Translation((x, y, z + sz / 2)) @ Matrix.Rotation(rot, 4, "Z") @ Matrix.Diagonal((sx, sy, sz, 1))
        res = bmesh.ops.create_cube(self.bm, size=1.0, matrix=m)
        self._finish(res["verts"], mat, bevel=min(bevel, sx / 2.1, sy / 2.1, sz / 2.1) if bevel else 0.0, bevel_segments=segments, vertical_only=vertical_only)

    def cyl(self, mat, r1, r2, h, x, y, z, seg=16):
        m = Matrix.Translation((x, y, z + h / 2))
        res = bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r1, radius2=r2, depth=h, matrix=m)
        self._finish(res["verts"], mat)

    def sphere(self, mat, r, x, y, z, subdiv=2, sx=1.0, sy=1.0, sz=1.0):
        m = Matrix.Translation((x, y, z)) @ Matrix.Diagonal((sx * r, sy * r, sz * r, 1))
        res = bmesh.ops.create_icosphere(self.bm, subdivisions=subdiv, radius=1.0, matrix=m)
        self._finish(res["verts"], mat)

    def uvsphere(self, mat, r, x, y, z, segs=32, rings=16, sz=1.0, hemi=False, ribs=0, rib_depth=0.05):
        m = Matrix.Translation((x, y, z)) @ Matrix.Diagonal((r, r, r * sz, 1))
        res = bmesh.ops.create_uvsphere(self.bm, u_segments=segs, v_segments=rings, radius=1.0, matrix=m)
        verts = res["verts"]
        if ribs:
            # melon-dome ribs (Timurid style): modulate the radius around the vertical axis
            for v in verts:
                dx, dy = v.co.x - x, v.co.y - y
                phi = math.atan2(dy, dx)
                k = 1.0 + rib_depth * abs(math.cos(ribs * phi / 2))
                v.co.x = x + dx * k
                v.co.y = y + dy * k
        if hemi:
            below = [v for v in verts if v.co.z < z - 1e-4]
            bmesh.ops.delete(self.bm, geom=below, context="VERTS")
            verts = [v for v in verts if v.is_valid]
        self._finish(verts, mat)

    def prism(self, mat, pts, z0, h):
        """Extrude a closed 2D polygon (x, y) upward."""
        verts = [self.bm.verts.new((px, py, z0)) for px, py in pts]
        face = self.bm.faces.new(verts)
        res = bmesh.ops.extrude_face_region(self.bm, geom=[face])
        top = [g for g in res["geom"] if isinstance(g, bmesh.types.BMVert)]
        bmesh.ops.translate(self.bm, vec=(0, 0, h), verts=top)
        bmesh.ops.recalc_face_normals(self.bm, faces=list(set(f for v in verts + top for f in v.link_faces)))
        self._finish(verts + top, mat)

    def build(self, collection, parent=None):
        mesh = bpy.data.meshes.new(self.name)
        self.bm.normal_update()
        self.bm.to_mesh(mesh)
        self.bm.free()
        for m in self.mats:
            mesh.materials.append(m)
        obj = bpy.data.objects.new(self.name, mesh)
        collection.objects.link(obj)
        if parent:
            obj.parent = parent
        if len(mesh.polygons):
            mesh.shade_smooth()
            if hasattr(mesh, "set_sharp_from_angle"):
                mesh.set_sharp_from_angle(angle=math.radians(32))
        return obj


# ───────────────────────────── architectural parts ─────────────────────────────


def curtain_storey(b, M, rnd, w, d, z, h, cx=0.0, cy=0.0, bay=1.8, fin_every=3, glass=None, balconies=False, lit=0.45, spandrel=0.0, slab_mat=None):
    """One storey of a rectangular tower: bevelled slab, framed glass panes, mullions, gold fins, lit interior."""
    glass = glass or M["glass"]
    slab_mat = slab_mat or M["stone"]
    slab = 0.34
    b.box(slab_mat, w + 0.5, d + 0.5, slab, cx, cy, z, bevel=0.06)
    gz = z + slab
    gh = h - slab
    inset = 0.25
    # interior: dark floor plate + ceiling light panels in random rooms
    b.box(M["interior"], w - 2.6, d - 2.6, 0.05, cx, cy, gz)
    b.box(M["interior"], w * 0.42, d * 0.42, gh - 0.2, cx, cy, gz)  # core
    faces = [
        (w, (0, d / 2 - inset), 0.0),
        (w, (0, -(d / 2 - inset)), math.pi),
        (d, (w / 2 - inset, 0), math.pi / 2),
        (d, (-(w / 2 - inset), 0), -math.pi / 2),
    ]
    for length, (ox, oy), ang in faces:
        n = max(2, round(length / bay))
        ux, uy = math.cos(ang), math.sin(ang)  # along-facade direction
        nx, ny = -math.sin(ang), math.cos(ang)  # outward normal
        if ang in (math.pi / 2, -math.pi / 2):
            ux, uy, nx, ny = 0.0, 1.0, (1.0 if ang > 0 else -1.0), 0.0
        if ang == math.pi:
            ux, uy, nx, ny = 1.0, 0.0, 0.0, -1.0
        if ang == 0.0:
            ux, uy, nx, ny = 1.0, 0.0, 0.0, 1.0
        rot = math.atan2(uy, ux)
        pane = length / n
        for i in range(n):
            t = -length / 2 + pane * (i + 0.5)
            px, py = cx + ox + ux * t, cy + oy + uy * t
            # glass pane (slightly recessed) + optional spandrel band
            if spandrel > 0:
                b.box(M["spandrel"], pane - 0.08, 0.06, spandrel, px, py, gz, rot=rot)
                b.box(glass, pane - 0.1, 0.03, gh - spandrel - 0.05, px - nx * 0.05, py - ny * 0.05, gz + spandrel, rot=rot)
            else:
                b.box(glass, pane - 0.1, 0.03, gh - 0.05, px - nx * 0.05, py - ny * 0.05, gz, rot=rot)
            # lit room behind
            if rnd.random() < lit:
                b.box(M["ceiling_light"], pane * 0.8, 1.2, 0.04, px - nx * 1.6, py - ny * 1.6, gz + gh - 0.32, rot=rot)
        # mullions & fins
        for i in range(n + 1):
            t = -length / 2 + pane * i
            px, py = cx + ox + ux * t, cy + oy + uy * t
            fin = fin_every and i % fin_every == 0 and 0 < i < n
            if fin:
                b.box(M["gold"], 0.14, 0.7, gh, px + nx * 0.35, py + ny * 0.35, gz, rot=rot, bevel=0.03)
            else:
                b.box(M["frame"], 0.07, 0.12, gh, px + nx * 0.04, py + ny * 0.04, gz, rot=rot)
        # transom
        b.box(M["frame"], length - 0.3, 0.1, 0.06, cx + ox + nx * 0.04, cy + oy + ny * 0.04, gz + 0.9 if not spandrel else gz + spandrel, rot=rot)
    if balconies:
        bays = max(2, round(w / 5.4))
        for side in (1, -1):
            for i in range(bays):
                if (i + int(z / h)) % 2:
                    continue
                bw = w / bays * 0.82
                bx = cx - w / 2 + w / bays * (i + 0.5)
                by = cy + side * (d / 2 + 0.95)
                b.box(slab_mat, bw, 1.9, 0.22, bx, by, z + 0.08, bevel=0.35, segments=4, vertical_only=True)
                b.box(M["wood"], bw - 0.2, 1.7, 0.02, bx, by, z + 0.06)  # soffit
                b.box(M["railing"], bw - 0.2, 0.025, 1.05, bx, by + side * 0.9, z + 0.3)
                b.box(M["gold"], bw - 0.15, 0.06, 0.05, bx, by + side * 0.9, z + 1.35, bevel=0.02)


def punched_storey(b, M, rnd, w, d, z, h, cx=0.0, cy=0.0, wall=None, win_w=1.6, lit=0.5, loggias=True):
    """Masonry-style storey: solid cladding with framed windows, sills and recessed loggias."""
    wall = wall or M["terracotta"]
    slab = 0.3
    b.box(M["stone"], w + 0.3, d + 0.3, slab, cx, cy, z, bevel=0.04)
    gz = z + slab
    gh = h - slab
    b.box(wall, w, d, gh, cx, cy, gz)
    # windows on long faces (as protruding frames + glass + sill, reading as punched openings)
    for side in (1, -1):
        n = max(3, round(w / 3.2))
        for i in range(n):
            x = cx - w / 2 + w / n * (i + 0.5)
            y = cy + side * (d / 2)
            loggia = loggias and i % 3 == 1
            ww = win_w * (1.6 if loggia else 1.0)
            if loggia:
                b.box(M["interior"], ww, 1.4, gh - 0.4, x, y - side * 0.7, gz + 0.1)
                b.box(M["railing"], ww, 0.03, 1.0, x, y + side * 0.02, gz + 0.1)
                b.box(M["gold"], ww, 0.05, 0.05, x, y + side * 0.03, gz + 1.1)
            b.box(M["frame"], ww + 0.16, 0.14, gh - 0.95, x, y + side * 0.02, gz + 0.55)
            b.box(M["glass_dark"], ww, 0.05, gh - 1.1, x, y + side * 0.06, gz + 0.62)
            b.box(M["stone"], ww + 0.3, 0.3, 0.07, x, y + side * 0.12, gz + 0.48)  # sill
            if rnd.random() < lit:
                b.box(M["ceiling_light"], ww * 0.8, 0.8, 0.04, x, y - side * 1.2, gz + gh - 0.3)
    for side in (1, -1):
        n = max(2, round(d / 3.4))
        for i in range(n):
            y = cy - d / 2 + d / n * (i + 0.5)
            x = cx + side * (w / 2)
            b.box(M["frame"], 0.14, win_w + 0.16, gh - 0.95, x + side * 0.02, y, gz + 0.55)
            b.box(M["glass_dark"], 0.05, win_w, gh - 1.1, x + side * 0.06, y, gz + 0.62)


def podium(col, M, rnd, w, d, floors=2, h=4.6, cx=0.0, cy=0.0, name="podium"):
    b = Builder(name)
    for f in range(floors):
        z = f * h
        b.box(M["stone_dark"], w + 0.6, d + 0.6, 0.5, cx, cy, z, bevel=0.05)
        b.box(M["glass_dark"], w - 0.4, d - 0.4, h - 0.5, cx, cy, z + 0.5)
        n = max(3, round(w / 5))
        for i in range(n + 1):
            x = cx - w / 2 + w / n * i
            for side in (1, -1):
                b.box(M["stone_dark"], 0.55, 0.55, h - 0.5, x, cy + side * (d / 2 - 0.1), z + 0.5, bevel=0.04)
        for i in range(n):
            if rnd.random() < 0.7:
                x = cx - w / 2 + w / n * (i + 0.5)
                b.box(M["ceiling_light"], w / n * 0.8, 2.0, 0.05, x, cy + d / 2 - 2.0, z + h - 0.45)
    # entrance canopy: wood soffit, gold edge, downlights
    b.box(M["stone"], w * 0.38, 5.0, 0.4, cx, cy + d / 2 + 2.4, h - 0.7, bevel=0.08)
    b.box(M["wood"], w * 0.36, 4.8, 0.04, cx, cy + d / 2 + 2.4, h - 0.74)
    b.box(M["gold"], w * 0.38 + 0.05, 0.12, 0.45, cx, cy + d / 2 + 4.9, h - 0.72, bevel=0.03)
    for i in range(6):
        b.cyl(M["accent_light"], 0.12, 0.12, 0.03, cx - w * 0.15 + i * w * 0.06, cy + d / 2 + 2.4, h - 0.77, seg=12)
    return b.build(col), floors * h


def crown_roof(b, M, w, d, z, cx=0.0, cy=0.0, crown=True):
    b.box(M["stone"], w + 0.5, d + 0.5, 0.5, cx, cy, z, bevel=0.06)
    for sx, sy, lx, ly in ((w + 0.5, 0.25, 0, d / 2 + 0.12), (w + 0.5, 0.25, 0, -d / 2 - 0.12), (0.25, d + 0.5, w / 2 + 0.12, 0), (0.25, d + 0.5, -w / 2 - 0.12, 0)):
        b.box(M["stone"], sx, sy, 1.1, cx + lx, cy + ly, z + 0.5)
    b.box(M["stone_dark"], w * 0.34, d * 0.38, 3.2, cx - w * 0.15, cy, z + 0.5, bevel=0.1)
    b.box(M["frame"], w * 0.2, d * 0.2, 1.2, cx + w * 0.22, cy, z + 0.5)
    if crown:
        ch = 5.0
        for px, py in ((w / 2, d / 2), (-w / 2, d / 2), (w / 2, -d / 2), (-w / 2, -d / 2)):
            b.box(M["gold"], 0.34, 0.34, ch, cx + px, cy + py, z + 0.5, bevel=0.05)
        b.box(M["gold"], w + 0.34, 0.34, 0.34, cx, cy + d / 2, z + 0.5 + ch, bevel=0.05)
        b.box(M["gold"], w + 0.34, 0.34, 0.34, cx, cy - d / 2, z + 0.5 + ch, bevel=0.05)
        b.box(M["gold"], 0.34, d + 0.34, 0.34, cx + w / 2, cy, z + 0.5 + ch, bevel=0.05)
        b.box(M["gold"], 0.34, d + 0.34, 0.34, cx - w / 2, cy, z + 0.5 + ch, bevel=0.05)
        b.box(M["accent_light"], w - 0.6, 0.06, 0.06, cx, cy + d / 2 - 0.2, z + 0.5 + ch - 0.12)
        b.box(M["accent_light"], w - 0.6, 0.06, 0.06, cx, cy - d / 2 + 0.2, z + 0.5 + ch - 0.12)


def tree(b, M, rnd, x, y, scale=1.0):
    h = (3.2 + rnd.random() * 2.2) * scale
    b.cyl(M["trunk"], 0.12 * scale, 0.2 * scale, h, x, y, 0.0, seg=7)
    mat = M["foliage"] if rnd.random() < 0.8 else M["foliage2"]
    for _ in range(4):
        r = (1.0 + rnd.random() * 0.8) * scale
        b.sphere(mat, r, x + rnd.uniform(-0.7, 0.7) * scale, y + rnd.uniform(-0.7, 0.7) * scale, h + rnd.uniform(-0.3, 0.9) * scale, subdiv=2, sz=0.85)


def car(b, M, rnd, x, y, rot):
    paint = rnd.choice(M["car_paint"])
    c, s = math.cos(rot), math.sin(rot)

    def at(dx, dy):
        return x + dx * c - dy * s, y + dx * s + dy * c

    b.box(paint, 4.5, 1.85, 0.75, x, y, 0.32, rot=rot, bevel=0.22, segments=3)
    cx_, cy_ = at(-0.25, 0)
    b.box(M["car_glass"], 2.4, 1.6, 0.55, cx_, cy_, 1.02, rot=rot, bevel=0.2, segments=3)
    for dx in (-1.45, 1.4):
        for dy in (-0.82, 0.82):
            wx, wy = at(dx, dy)
            b.box(M["tyre"], 0.68, 0.24, 0.68, wx, wy, 0.0, rot=rot, bevel=0.2, segments=3)


def site(col, M, rnd, size=150, pool=True, playground=False, footprint=(60, 40)):
    b = Builder("site")
    half = size / 2
    b.box(M["asphalt"], size * 1.3, size * 1.3, 0.1, 0, 0, -0.12)
    if not WEB_ONLY:
        # distant ground for renders only (not exported) so the horizon never shows the void
        g = bpy.data.objects.new("far-ground", bpy.data.meshes.new("far-ground"))
        gb = bmesh.new()
        bmesh.ops.create_grid(gb, x_segments=1, y_segments=1, size=4000)
        gb.to_mesh(g.data)
        gb.free()
        g.data.materials.append(M["far_ground"])
        g.location.z = -0.2
        col.objects.link(g)
    # plaza + curbs
    b.box(M["plaza"], size, size, 0.12, 0, 0, -0.02, bevel=0.03)
    # roads on two sides with dashed markings
    for axis in ("x", "y"):
        for i in range(-12, 13):
            if axis == "x":
                b.box(M["marking"], 3.0, 0.15, 0.01, i * 7.0, -half - 6.0, -0.01)
            else:
                b.box(M["marking"], 0.15, 3.0, 0.01, half + 6.0, i * 7.0, -0.01)
    b.box(M["curb"], size + 0.6, 0.4, 0.18, 0, -half - 0.2, -0.02)
    b.box(M["curb"], 0.4, size + 0.6, 0.18, half + 0.2, 0, -0.02)
    fw, fd = footprint
    # lawns with curbs (avoid the building footprint)
    lawns = [(-half * 0.62, half * 0.62, size * 0.3, size * 0.26), (half * 0.62, half * 0.62, size * 0.3, size * 0.26), (-half * 0.62, -half * 0.6, size * 0.3, size * 0.24)]
    for lx, ly, lw, ld in lawns:
        b.box(M["curb"], lw + 0.4, ld + 0.4, 0.16, lx, ly, 0.0)
        b.box(M["grass"], lw, ld, 0.2, lx, ly, 0.0)
        for _ in range(int(lw * ld / 55)):
            tree(b, M, rnd, lx + rnd.uniform(-lw / 2 + 1.5, lw / 2 - 1.5), ly + rnd.uniform(-ld / 2 + 1.5, ld / 2 - 1.5), scale=rnd.uniform(0.85, 1.25))
    if pool:
        px, py = half * 0.6, -half * 0.58
        b.box(M["stone"], 22, 12, 0.25, px, py, 0.0, bevel=0.1)
        b.box(M["water"], 19, 9, 0.08, px, py, 0.2)
        for i in range(5):
            b.box(M["wood"], 0.8, 2.0, 0.35, px - 8 + i * 4, py - 8.0, 0.0, bevel=0.08)
    if playground:
        gx, gy = -half * 0.62, -half * 0.6
        b.box(M["play"], 8, 8, 0.05, gx, gy, 0.2)
        b.box(M["gold"], 0.15, 0.15, 2.4, gx - 2, gy, 0.2)
        b.box(M["gold"], 0.15, 0.15, 2.4, gx + 2, gy, 0.2)
        b.box(M["gold"], 4.2, 0.15, 0.15, gx, gy, 2.6)
    # street lamps along the roads
    for i in range(-5, 6):
        for lx, ly in ((i * 12.0, -half + 1.2), (half - 1.2, i * 12.0)):
            b.cyl(M["lamp_pole"], 0.07, 0.1, 5.2, lx, ly, 0.0, seg=8)
            b.box(M["lamp_pole"], 0.9, 0.22, 0.12, lx, ly, 5.15)
            b.box(M["accent_light"], 0.6, 0.16, 0.04, lx, ly, 5.1)
    # benches
    for i in range(-3, 4):
        b.box(M["wood"], 2.0, 0.6, 0.45, i * 8.0, half * 0.35, 0.05, bevel=0.06)
    # parked & moving cars
    for i in range(9):
        car(b, M, rnd, -half + 10 + i * 13 + rnd.uniform(-2, 2), -half - 3.5 if i % 2 else -half - 8.5, 0.0 if i % 2 else math.pi)
    for i in range(6):
        car(b, M, rnd, half + 4.0 if i % 2 else half + 8.5, -half + 15 + i * 18, math.pi / 2)
    return b.build(col)


# ───────────────────────────── typologies ─────────────────────────────


def make_towers(col, M, rnd, towers, w, d, h=3.3, balconies=True, glass="glass", podium_floors=2, pool=True):
    site(col, M, rnd, size=170 if len(towers) > 1 else 130, pool=pool, footprint=(w * len(towers), d))
    xs = [t[0] for t in towers]
    pw = (max(xs) - min(xs)) + w + 10
    _, base = podium(col, M, rnd, pw, d + 10, floors=podium_floors, cx=(max(xs) + min(xs)) / 2)
    top = max(t[2] for t in towers)
    for f in range(1, top + 1):
        b = Builder(f"floor-{f}")
        for tx, ty, floors in towers:
            if f <= floors:
                curtain_storey(b, M, rnd, w, d, base + (f - 1) * h, h, cx=tx, cy=ty, balconies=balconies and f > 1, glass=M[glass])
        b.build(col)
    r = Builder("roof")
    for tx, ty, floors in towers:
        crown_roof(r, M, w, d, base + floors * h, cx=tx, cy=ty)
    r.build(col)
    return base + top * h


def make_family_quarter(col, M, rnd, floors=16, h=3.1):
    site(col, M, rnd, size=180, pool=False, playground=True)
    blocks = [(-36, 0, floors, "terracotta"), (0, -10, floors - 2, "stone_warm"), (36, 0, floors, "terracotta")]
    _, base = podium(col, M, rnd, 104, 26, floors=1)
    for f in range(1, floors + 1):
        b = Builder(f"floor-{f}")
        for bx, by, fl, mat in blocks:
            if f <= fl:
                punched_storey(b, M, rnd, 26, 16, base + (f - 1) * h, h, cx=bx, cy=by, wall=M[mat])
        b.build(col)
    r = Builder("roof")
    for bx, by, fl, _ in blocks:
        crown_roof(r, M, 26, 16, base + fl * h, cx=bx, cy=by, crown=False)
        r.box(M["gold"], 26.5, 0.3, 0.6, bx, by + 8.2, base + fl * h + 0.5, bevel=0.05)
    r.build(col)
    return base + floors * h


def make_courtyard(col, M, rnd, floors=12, h=3.2):
    site(col, M, rnd, size=170, pool=False, playground=True)
    wings = [(0, -24, 62, 14), (-24, 4, 14, 42), (24, 4, 14, 42)]
    _, base = podium(col, M, rnd, 66, 16, floors=1, cy=-24)
    for f in range(1, floors + 1):
        b = Builder(f"floor-{f}")
        for cx, cy, w, d in wings:
            curtain_storey(b, M, rnd, w, d, base + (f - 1) * h, h, cx=cx, cy=cy, bay=2.2, fin_every=4, spandrel=0.9, slab_mat=M["stone_warm"])
        b.build(col)
    r = Builder("roof")
    for cx, cy, w, d in wings:
        crown_roof(r, M, w, d, base + floors * h, cx=cx, cy=cy, crown=False)
    # roof garden
    r.box(M["grass"], 20, 30, 0.3, -24, 4, base + floors * h + 0.5)
    for _ in range(6):
        tree(r, M, rnd, -24 + rnd.uniform(-7, 7), 4 + rnd.uniform(-12, 12), scale=0.5)
    # courtyard garden & fountain
    r.box(M["grass"], 30, 28, 0.15, 0, 10, 0.0)
    r.cyl(M["stone"], 3.2, 3.2, 0.5, 0, 10, 0.0, seg=32)
    r.cyl(M["water"], 2.8, 2.8, 0.1, 0, 10, 0.45, seg=32)
    for _ in range(10):
        tree(r, M, rnd, rnd.uniform(-13, 13), 10 + rnd.uniform(-12, 12), scale=0.9)
    r.build(col)
    return base + floors * h


def make_business(col, M, rnd, floors=18, h=3.9):
    site(col, M, rnd, size=130, pool=True)
    _, base = podium(col, M, rnd, 44, 36, floors=2, h=5.2)
    for f in range(1, floors + 1):
        b = Builder(f"floor-{f}")
        sb = 4 if f > floors - 3 else 2 if f > floors - 7 else 0
        w, d = 30 - sb * 2, 26 - sb * 2
        # chamfered-corner glass box: main curtain + gold corner blades
        curtain_storey(b, M, rnd, w, d, base + (f - 1) * h, h, bay=1.5, fin_every=2, glass=M["glass_dark"], lit=0.6)
        for px, py in ((w / 2, d / 2), (-w / 2, d / 2), (w / 2, -d / 2), (-w / 2, -d / 2)):
            b.box(M["gold"], 0.5, 0.5, h, px, py, base + (f - 1) * h, rot=math.pi / 4, bevel=0.05)
        b.build(col)
    r = Builder("roof")
    crown_roof(r, M, 22, 18, base + floors * h)
    # helipad-like lit ring
    r.cyl(M["accent_light"], 4.2, 4.2, 0.05, 4, 0, base + floors * h + 0.55, seg=48)
    r.cyl(M["stone_dark"], 3.9, 3.9, 0.07, 4, 0, base + floors * h + 0.55, seg=48)
    r.build(col)
    return base + floors * h


def pointed_arch_points(w, h, spring=0.62, steps=12):
    """Outline of a pointed (Timurid) arch opening, bottom at y=0, as a list of (x, y)."""
    pts = [(-w / 2, 0.0), (w / 2, 0.0), (w / 2, h * spring)]
    for i in range(1, steps + 1):
        t = i / steps
        # quadratic towards the apex from the right
        x = (1 - t) ** 2 * (w / 2) + 2 * (1 - t) * t * (w / 2) + t * t * 0
        y = (1 - t) ** 2 * (h * spring) + 2 * (1 - t) * t * (h * 0.93) + t * t * h
        pts.append((x, y))
    for i in range(1, steps):
        t = i / steps
        x = (1 - t) ** 2 * 0 + 2 * (1 - t) * t * (-w / 2) + t * t * (-w / 2)
        y = (1 - t) ** 2 * h + 2 * (1 - t) * t * (h * 0.93) + t * t * (h * spring)
        pts.append((x, y))
    pts.append((-w / 2, h * spring))
    return pts


def arch_frame(b, mat, cx, cy, z, w, h, depth, facing_y=1, band=0.35):
    """Arch outline as a band of small blocks following a pointed arch (vertical plane)."""
    pts = pointed_arch_points(w, h)
    outline = pts[2:] + [pts[0]]
    for (x1, y1), (x2, y2) in zip(outline[:-1], outline[1:]):
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        seg = math.hypot(x2 - x1, y2 - y1)
        ang = math.atan2(y2 - y1, x2 - x1)
        # build in XZ plane: rotate around Y by -ang
        m = Matrix.Translation((cx + mx, cy, z + my)) @ Matrix.Rotation(-ang, 4, "Y") @ Matrix.Diagonal((seg + 0.04, depth, band, 1))
        res = bmesh.ops.create_cube(b.bm, size=1.0, matrix=m)
        b._finish(res["verts"], mat)
    b.box(mat, band, depth, h * 0.62, cx - w / 2 - band / 2, cy, z)
    b.box(mat, band, depth, h * 0.62, cx + w / 2 + band / 2, cy, z)


def make_heritage(col, M, rnd, floors=7, h=3.5):
    site(col, M, rnd, size=150, pool=False)
    W, D = 52.0, 18.0
    _, base = podium(col, M, rnd, W + 4, D + 4, floors=1, h=5.0)
    for f in range(1, floors + 1):
        b = Builder(f"floor-{f}")
        z = base + (f - 1) * h
        b.box(M["stone_warm"], W + 0.4, D + 0.4, 0.3, 0, 0, z, bevel=0.04)
        b.box(M["brick"], W, D, h - 0.3, 0, 0, z + 0.3)
        n = 10
        for i in range(n):
            x = -W / 2 + W / n * (i + 0.5)
            aw, ah = W / n - 1.5, h - 1.1
            for side in (1, -1):
                y = side * (D / 2 + 0.05)
                b.box(M["interior"], aw, 0.6, ah, x, y - side * 0.3, z + 0.5)
                b.box(M["glass_dark"], aw - 0.2, 0.04, ah * 0.6, x, y - side * 0.45, z + 0.5)
                arch_frame(b, M["tile"] if (i + f) % 2 else M["stone"], x, y + side * 0.08, z + 0.5, aw, ah, 0.22)
                if rnd.random() < 0.5:
                    b.box(M["ceiling_light"], aw * 0.7, 0.6, 0.04, x, y - side * 1.2, z + h - 0.35)
        b.box(M["tile_blue"], W + 0.5, D + 0.5, 0.16, 0, 0, z + h - 0.24)  # majolica band
        b.build(col)
    r = Builder("roof")
    top = base + floors * h
    r.box(M["brick"], W + 0.5, D + 0.5, 0.9, 0, 0, top, bevel=0.05)
    r.box(M["tile"], W + 0.6, D + 0.6, 0.2, 0, 0, top + 0.9)
    # pishtaq portal — pylons + crown band framing a deep pointed niche (no booleans needed)
    pw, ph = 14.0, h * 3 + 5
    pz = top - h * 3
    fy = D / 2 + 2.2  # front plane of the portal
    for sx in (-1, 1):
        r.box(M["brick"], 2.4, 2.8, ph, sx * (pw / 2 - 1.2), fy - 1.4, pz, bevel=0.05)
        r.box(M["tile"], 0.4, 2.9, ph - 0.6, sx * (pw / 2 - 0.25), fy - 1.4, pz)
        r.box(M["tile_blue"], 0.35, 0.1, ph * 0.8, sx * (pw / 2 - 2.0), fy + 0.02, pz + 0.3)
    r.box(M["brick"], pw, 2.8, ph * 0.14, 0, fy - 1.4, pz + ph * 0.86, bevel=0.05)
    r.box(M["tile_blue"], pw - 0.8, 2.9, 0.7, 0, fy - 1.4, pz + ph - 1.3)
    r.box(M["tile"], pw - 0.8, 2.9, 0.25, 0, fy - 1.4, pz + ph - 0.45)
    # recessed niche: lapis back wall, glazed entrance, lit soffit
    niche_w = pw - 4.8
    r.box(M["tile_blue"], niche_w, 0.5, ph * 0.86, 0, fy - 2.6, pz)
    r.box(M["glass_dark"], niche_w * 0.55, 0.1, ph * 0.42, 0, fy - 2.3, pz)
    r.box(M["accent_light"], niche_w * 0.5, 0.6, 0.06, 0, fy - 1.8, pz + ph * 0.44)
    arch_frame(r, M["tile"], 0, fy - 0.05, pz, niche_w, ph * 0.84, 0.5, band=0.55)
    r.box(M["brick"], pw, 2.8, 0.6, 0, fy - 1.4, pz - 0.6)
    # drum + ribbed turquoise dome + gold finial
    r.cyl(M["brick"], 6.0, 6.0, 4.0, 0, -1.5, top + 0.9, seg=48)
    r.cyl(M["tile_blue"], 6.05, 6.05, 0.6, 0, -1.5, top + 4.0, seg=48)
    r.uvsphere(M["tile"], 6.4, 0, -1.5, top + 4.6, segs=96, rings=32, sz=1.35, hemi=True, ribs=24, rib_depth=0.06)
    r.cyl(M["gold"], 6.5, 6.5, 0.25, 0, -1.5, top + 4.55, seg=48)
    r.cyl(M["gold"], 0.12, 0.32, 3.2, 0, -1.5, top + 4.6 + 6.4 * 1.35 - 0.3, seg=12)
    r.sphere(M["gold"], 0.35, 0, -1.5, top + 4.6 + 6.4 * 1.35 + 1.8, subdiv=2)
    # guldasta corner turrets
    for x in (-W / 2 + 1.5, W / 2 - 1.5):
        for y in (D / 2 - 1.5, -D / 2 + 1.5):
            r.cyl(M["brick"], 1.1, 1.3, 7.0, x, y, top + 0.9, seg=24)
            r.cyl(M["tile"], 1.2, 1.2, 0.5, x, y, top + 7.0, seg=24)
            r.uvsphere(M["tile"], 1.15, x, y, top + 7.5, segs=24, rings=12, sz=1.4, hemi=True)
            r.cyl(M["gold"], 0.04, 0.1, 1.0, x, y, top + 9.0, seg=8)
    r.build(col)
    return top + 16


TYPOLOGIES = {
    "tower-twin": lambda col, M, rnd: make_towers(col, M, rnd, [(-22.0, 0.0, 22), (22.0, 5.0, 19)], 34.0, 18.0),
    "tower-single": lambda col, M, rnd: make_towers(col, M, rnd, [(0.0, 0.0, 18)], 32.0, 18.0),
    "family-quarter": make_family_quarter,
    "courtyard-block": make_courtyard,
    "business-tower": make_business,
    "heritage-residence": make_heritage,
}


# ───────────────────────────── lighting, cameras, render ─────────────────────────────


def setup_world(scene, sun_elev_deg=8.0, sun_rot_deg=215.0, strength=0.45):
    world = bpy.data.worlds.new("sky")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    sky = nt.nodes.new("ShaderNodeTexSky")
    for t in ("MULTIPLE_SCATTERING", "NISHITA", "SINGLE_SCATTERING", "HOSEK_WILKIE"):
        try:
            sky.sky_type = t
            break
        except TypeError:
            continue
    for attr, val in (("sun_elevation", math.radians(sun_elev_deg)), ("sun_rotation", math.radians(sun_rot_deg)), ("altitude", 0.0), ("air_density", 1.2), ("dust_density", 2.0), ("ozone_density", 1.0), ("sun_intensity", 0.6)):
        if hasattr(sky, attr):
            setattr(sky, attr, val)
    bg.inputs["Strength"].default_value = strength
    nt.links.new(sky.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    # warm key sun to sharpen shadows
    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy = 3.2
    sun.color = (1.0, 0.82, 0.62)
    sun.angle = math.radians(1.2)
    so = bpy.data.objects.new("sun", sun)
    scene.collection.objects.link(so)
    so.rotation_euler = (math.radians(90 - sun_elev_deg), 0, math.radians(sun_rot_deg))
    return so


def add_camera(scene, loc, target, lens=28):
    cam = bpy.data.cameras.new("cam")
    cam.lens = lens
    cam.clip_end = 3000
    co = bpy.data.objects.new("cam", cam)
    scene.collection.objects.link(co)
    co.location = loc
    direction = Vector(target) - Vector(loc)
    co.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.camera = co
    return co


def render(scene, path, samples=48, res=(1600, 1000)):
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.03
    scene.cycles.use_denoising = True
    try:
        scene.cycles.denoiser = "OPENIMAGEDENOISE"
    except TypeError:
        pass
    scene.cycles.max_bounces = 8
    scene.cycles.transmission_bounces = 8
    scene.cycles.glossy_bounces = 4
    scene.cycles.diffuse_bounces = 3
    scene.cycles.caustics_reflective = False
    scene.cycles.caustics_refractive = False
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 88
    for vt in ("AgX", "Filmic"):
        try:
            scene.view_settings.view_transform = vt
            break
        except TypeError:
            continue
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass
    scene.view_settings.exposure = -0.4
    scene.render.filepath = path
    t = time.time()
    bpy.ops.render.render(write_still=True)
    print(f"  ⤷ render {os.path.basename(path)} {time.time() - t:.0f}s", flush=True)


def scene_bounds(col):
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for o in col.objects:
        if o.type != "MESH" or o.name in ("site", "far-ground"):
            continue
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            mn = Vector(map(min, mn, w))
            mx = Vector(map(max, mx, w))
    return mn, mx


def export_glb(path):
    # export everything except render-only helpers
    for o in bpy.context.scene.objects:
        o.select_set(o.name != "far-ground" and o.type == "MESH")
    kwargs = dict(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_cameras=False, export_lights=False, export_materials="EXPORT")
    try:
        bpy.ops.export_scene.gltf(**kwargs, export_draco_mesh_compression_enable=False)
    except TypeError:
        bpy.ops.export_scene.gltf(**kwargs)


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", default=",".join(TYPOLOGIES))
    ap.add_argument("--no-render", action="store_true")
    ap.add_argument("--samples", type=int, default=48)
    ap.add_argument("--views", default="hero,aerial")
    ap.add_argument("--clay", default="family-quarter", help="also render a white clay concept view of this model")
    ap.add_argument("--stages", default="", help="construction stages to render, e.g. 15,40,65,85 (percent of floors built)")
    args = ap.parse_args(argv)
    os.makedirs(OUT_MODELS, exist_ok=True)
    os.makedirs(OUT_RENDERS, exist_ok=True)

    for name in [m for m in args.models.split(",") if m]:
        t0 = time.time()
        scene = reset_scene()
        M = make_materials()
        rnd = random.Random(hash(name) & 0xFFFF)
        col = bpy.data.collections.new(name)
        scene.collection.children.link(col)
        height = TYPOLOGIES[name](col, M, rnd)
        glb = os.path.join(OUT_MODELS, f"{name}.glb")
        export_glb(glb)
        print(f"✓ {name}.glb {os.path.getsize(glb) / 1e6:.2f} MB  ({time.time() - t0:.0f}s)", flush=True)
        if args.no_render:
            continue
        mn, mx = scene_bounds(col)
        c = (mn + mx) / 2
        size = max(mx.x - mn.x, mx.y - mn.y, height)
        setup_world(scene, sun_elev_deg=16.0, sun_rot_deg=205.0)
        views = {
            "hero": ((c.x + size * 0.85, c.y + size * 1.05, 9.0 + height * 0.12), (c.x, c.y, height * 0.45), 26),
            "aerial": ((c.x - size * 1.45, c.y + size * 1.35, height * 1.15 + size * 0.25), (c.x, c.y, height * 0.38), 28),
            "detail": ((c.x + size * 0.35, c.y + size * 0.75, 2.0), (c.x, c.y, height * 0.65), 20),
        }
        for v in args.views.split(","):
            loc, tgt, lens = views[v]
            add_camera(scene, loc, tgt, lens)
            render(scene, os.path.join(OUT_RENDERS, f"{name}-{v}.jpg"), samples=args.samples)
        if args.stages:
            floors = sorted((o for o in col.objects if o.name.startswith("floor-")), key=lambda o: int(o.name.split("-")[1]))
            roof = col.objects.get("roof")
            loc, tgt, lens = views["hero"]
            add_camera(scene, loc, tgt, lens)
            for pct in [int(p) for p in args.stages.split(",") if p]:
                built = max(1, round(len(floors) * pct / 100))
                for i, o in enumerate(floors):
                    o.hide_render = i >= built
                if roof:
                    roof.hide_render = pct < 100
                render(scene, os.path.join(OUT_RENDERS, f"{name}-stage-{pct}.jpg"), samples=max(16, args.samples // 2), res=(1280, 800))
            for o in floors:
                o.hide_render = False
            if roof:
                roof.hide_render = False
        if name == args.clay:
            clay = principled("clay", hex2rgb("#f1eee8"), roughness=0.6)
            scene.view_layers[0].material_override = clay
            loc, tgt, lens = views["aerial"]
            add_camera(scene, loc, tgt, lens)
            render(scene, os.path.join(OUT_RENDERS, f"{name}-clay.jpg"), samples=max(24, args.samples // 2))
            scene.view_layers[0].material_override = None
        print(f"  done {name} in {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
