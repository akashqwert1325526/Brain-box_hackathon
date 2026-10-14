"""
Problem 3: Budget Traveller with Coupons - Native Tkinter Desktop Visualizer
Features:
- Directed weighted graph with cities as nodes and flights as edges
- Start = Green, Destination = Red, Intermediate Stops = Orange
- Chosen path highlighted with glowing cyan and gold
- Coupon flight highlighted in Gold displaying original -> discounted price
- Animated journey traversal showing running cost and stops used
- Interactive controls: Play, Pause, Step Forward/Back, Reset, Speed, Load CSV, Generate Graph, Export CSV
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import math
import time
from typing import List, Tuple, Dict, Optional
from traveller_solver import Flight, FlightStep, SolverResult, solve_budget_traveller, read_flights_from_csv, export_solution_csv, generate_valid_graph


COLOR_BG = "#0B1120"
COLOR_PANEL = "#111827"
COLOR_START = "#10B981"         # Emerald Green
COLOR_DEST = "#EF4444"          # Ruby Red
COLOR_STOP = "#F97316"          # Orange
COLOR_CITY_DEFAULT = "#1E293B"  # Slate Dark
COLOR_PATH = "#38BDF8"          # Cyan Path
COLOR_COUPON = "#FFD700"        # Pure Gold
COLOR_EDGE_DEFAULT = "#475569"   # Muted slate edge


class TravellerVisualizerGUI:
    def __init__(self, root: tk.Tk, N: int = 5, K: int = 2, C: int = 1, flights: Optional[List[Flight]] = None):
        self.root = root
        self.root.title("Problem 3: Budget Traveller with Coupons - Desktop Visualizer")
        self.root.geometry("1180x840")
        self.root.minsize(980, 720)
        self.root.configure(bg=COLOR_BG)

        self.N = N
        self.K = K
        self.C = C
        self.flights = flights if flights else [
            Flight(1, 1, 2, 104),
            Flight(2, 2, 3, 618),
            Flight(3, 3, 5, 110),
            Flight(4, 5, 3, 99),
            Flight(5, 4, 2, 824),
            Flight(6, 5, 4, 973),
            Flight(7, 3, 1, 396),
            Flight(8, 1, 4, 643),
        ]

        self.solution: Optional[SolverResult] = None
        self.city_coords: Dict[int, Tuple[float, float]] = {}
        self.dragged_node: Optional[int] = None
        self.drag_offset: Tuple[float, float] = (0, 0)

        # Playback animation state
        self.current_step = 0
        self.anim_hop = 0
        self.anim_t = 0.0
        self.is_playing = False
        self.anim_job = None
        self.speed_ms = 40  # frame interval

        self._init_ui()
        self._solve_and_update()

    def _init_ui(self):
        # Header Bar
        header = tk.Frame(self.root, bg="#0F172A", height=58, padx=20, pady=10)
        header.pack(fill=tk.X, side=tk.TOP)

        brand_lbl = tk.Label(header, text="✈️ Problem 3: Budget Traveller Visualizer",
                             font=("Segoe UI", 16, "bold"), fg="#F8FAFC", bg="#0F172A")
        brand_lbl.pack(side=tk.LEFT)

        badge = tk.Label(header, text="Dijkstra Multi-State (City, Flights, Coupons)",
                         font=("Segoe UI", 9, "bold"), fg="#38BDF8", bg="#1E293B", padx=10, pady=4)
        badge.pack(side=tk.LEFT, padx=16)

        # Main Layout: Sidebar & Canvas
        main_frame = tk.Frame(self.root, bg=COLOR_BG, padx=14, pady=12)
        main_frame.pack(fill=tk.BOTH, expand=True)

        sidebar = tk.Frame(main_frame, bg=COLOR_PANEL, width=320, padx=14, pady=14, relief=tk.FLAT)
        sidebar.pack(side=tk.LEFT, fill=tk.Y, padx=(0, 14))
        sidebar.pack_propagate(False)

        # Config Panel
        lbl_cfg = tk.Label(sidebar, text="⚙️ NETWORK CONFIG", font=("Segoe UI", 10, "bold"), fg="#94A3B8", bg=COLOR_PANEL)
        lbl_cfg.pack(anchor=tk.W, pady=(0, 10))

        row_params = tk.Frame(sidebar, bg=COLOR_PANEL)
        row_params.pack(fill=tk.X, pady=4)

        tk.Label(row_params, text="Cities (N):", font=("Segoe UI", 9), fg="#CBD5E1", bg=COLOR_PANEL).grid(row=0, column=0, sticky=tk.W)
        self.ent_n = tk.Entry(row_params, width=6, font=("Consolas", 10), bg="#1E293B", fg="#FFF", insertbackground="white")
        self.ent_n.insert(0, str(self.N))
        self.ent_n.grid(row=0, column=1, padx=6)

        tk.Label(row_params, text="Max Stops (K):", font=("Segoe UI", 9), fg="#CBD5E1", bg=COLOR_PANEL).grid(row=0, column=2, sticky=tk.W, padx=(10, 0))
        self.ent_k = tk.Entry(row_params, width=6, font=("Consolas", 10), bg="#1E293B", fg="#FFF", insertbackground="white")
        self.ent_k.insert(0, str(self.K))
        self.ent_k.grid(row=0, column=3, padx=6)

        row_c = tk.Frame(sidebar, bg=COLOR_PANEL)
        row_c.pack(fill=tk.X, pady=6)
        tk.Label(row_c, text="Coupons (C):", font=("Segoe UI", 9), fg="#CBD5E1", bg=COLOR_PANEL).pack(side=tk.LEFT)
        self.ent_c = tk.Entry(row_c, width=6, font=("Consolas", 10), bg="#1E293B", fg="#FFF", insertbackground="white")
        self.ent_c.insert(0, str(self.C))
        self.ent_c.pack(side=tk.LEFT, padx=6)
        tk.Label(row_c, text="(50% discount)", font=("Segoe UI", 8), fg="#F59E0B", bg=COLOR_PANEL).pack(side=tk.LEFT)

        # Buttons in sidebar
        btn_solve = tk.Button(sidebar, text="⚡ Solve & Find Route", font=("Segoe UI", 10, "bold"),
                              bg="#2563EB", fg="#FFF", activebackground="#3B82F6", activeforeground="#FFF",
                              relief=tk.FLAT, pady=6, cursor="hand2", command=self._on_solve_clicked)
        btn_solve.pack(fill=tk.X, pady=(10, 6))

        btn_gen = tk.Button(sidebar, text="🎲 Random Solvable Network", font=("Segoe UI", 9),
                            bg="#334155", fg="#FFF", relief=tk.FLAT, pady=4, cursor="hand2", command=self._on_generate_clicked)
        btn_gen.pack(fill=tk.X, pady=4)

        btn_load = tk.Button(sidebar, text="📥 Load Flights CSV", font=("Segoe UI", 9),
                             bg="#334155", fg="#FFF", relief=tk.FLAT, pady=4, cursor="hand2", command=self._on_load_csv_clicked)
        btn_load.pack(fill=tk.X, pady=4)

        # HUD Panel
        tk.Frame(sidebar, height=1, bg="#334155").pack(fill=tk.X, pady=14)
        lbl_hud = tk.Label(sidebar, text="🎫 JOURNEY TRACKER HUD", font=("Segoe UI", 10, "bold"), fg="#F59E0B", bg=COLOR_PANEL)
        lbl_hud.pack(anchor=tk.W, pady=(0, 6))

        hud_card = tk.Frame(sidebar, bg="#1E293B", padx=12, pady=10, relief=tk.FLAT)
        hud_card.pack(fill=tk.X, pady=6)

        tk.Label(hud_card, text="RUNNING COST:", font=("Segoe UI", 8, "bold"), fg="#94A3B8", bg="#1E293B").pack(anchor=tk.W)
        self.lbl_cost = tk.Label(hud_card, text="$0", font=("Consolas", 22, "bold"), fg="#38BDF8", bg="#1E293B")
        self.lbl_cost.pack(anchor=tk.W)

        row_hud_stats = tk.Frame(hud_card, bg="#1E293B")
        row_hud_stats.pack(fill=tk.X, pady=(6, 0))

        tk.Label(row_hud_stats, text="Stops:", font=("Segoe UI", 8), fg="#94A3B8", bg="#1E293B").grid(row=0, column=0, sticky=tk.W)
        self.lbl_stops = tk.Label(row_hud_stats, text="0 / 2", font=("Consolas", 9, "bold"), fg="#FFF", bg="#1E293B")
        self.lbl_stops.grid(row=0, column=1, sticky=tk.W, padx=(4, 12))

        tk.Label(row_hud_stats, text="Coupons:", font=("Segoe UI", 8), fg="#94A3B8", bg="#1E293B").grid(row=0, column=2, sticky=tk.W)
        self.lbl_coupons = tk.Label(row_hud_stats, text="0 / 1", font=("Consolas", 9, "bold"), fg="#F59E0B", bg="#1E293B")
        self.lbl_coupons.grid(row=0, column=3, sticky=tk.W, padx=4)

        # Path Breakdown Tree/List
        tk.Frame(sidebar, height=1, bg="#334155").pack(fill=tk.X, pady=14)
        lbl_path = tk.Label(sidebar, text="📋 CHOSEN PATH", font=("Segoe UI", 10, "bold"), fg="#94A3B8", bg=COLOR_PANEL)
        lbl_path.pack(anchor=tk.W, pady=(0, 6))

        self.listbox_path = tk.Listbox(sidebar, bg="#0B1120", fg="#E2E8F0", font=("Consolas", 9),
                                       height=7, selectbackground="#0284C7", relief=tk.FLAT)
        self.listbox_path.pack(fill=tk.X, pady=4)

        btn_exp = tk.Button(sidebar, text="💾 Export Solution CSV", font=("Segoe UI", 9, "bold"),
                            bg="#059669", fg="#FFF", relief=tk.FLAT, pady=5, cursor="hand2", command=self._export_csv)
        btn_exp.pack(fill=tk.X, pady=(10, 0))

        # Center Stage
        stage = tk.Frame(main_frame, bg=COLOR_PANEL, relief=tk.FLAT, padx=12, pady=12)
        stage.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True)

        # Stage Top Bar
        top_bar = tk.Frame(stage, bg=COLOR_PANEL)
        top_bar.pack(fill=tk.X, pady=(0, 8))

        self.lbl_status = tk.Label(top_bar, text="Ready", font=("Segoe UI", 9, "bold"), fg="#38BDF8", bg=COLOR_PANEL)
        self.lbl_status.pack(side=tk.LEFT)

        # Legend
        leg_frame = tk.Frame(top_bar, bg=COLOR_PANEL)
        leg_frame.pack(side=tk.RIGHT)

        def add_leg(color, text):
            c_box = tk.Canvas(leg_frame, width=12, height=12, bg=color, highlightthickness=0)
            c_box.pack(side=tk.LEFT, padx=(8, 3))
            tk.Label(leg_frame, text=text, font=("Segoe UI", 8), fg="#94A3B8", bg=COLOR_PANEL).pack(side=tk.LEFT)

        add_leg(COLOR_START, "Start (1)")
        add_leg(COLOR_DEST, "Dest (N)")
        add_leg(COLOR_STOP, "Stop")
        add_leg(COLOR_PATH, "Chosen Path")
        add_leg(COLOR_COUPON, "🎟️ 50% Coupon")

        # Canvas
        self.canvas = tk.Canvas(stage, bg="#020617", highlightthickness=1, highlightbackground="#1E293B")
        self.canvas.pack(fill=tk.BOTH, expand=True)
        self.canvas.bind("<Configure>", lambda e: self._on_canvas_resize())
        self.canvas.bind("<Button-1>", self._on_mouse_down)
        self.canvas.bind("<B1-Motion>", self._on_mouse_drag)
        self.canvas.bind("<ButtonRelease-1>", self._on_mouse_up)

        # Playback Deck
        deck = tk.Frame(stage, bg="#0F172A", padx=14, pady=10)
        deck.pack(fill=tk.X, pady=(10, 0))

        btn_rst = tk.Button(deck, text="⏮ Reset", font=("Segoe UI", 9), bg="#334155", fg="#FFF", relief=tk.FLAT, padx=8, command=self._reset_playback)
        btn_rst.pack(side=tk.LEFT, padx=3)

        btn_prev = tk.Button(deck, text="◀ Prev", font=("Segoe UI", 9), bg="#334155", fg="#FFF", relief=tk.FLAT, padx=8, command=self._step_back)
        btn_prev.pack(side=tk.LEFT, padx=3)

        self.btn_play = tk.Button(deck, text="▶ Play", font=("Segoe UI", 9, "bold"), bg="#10B981", fg="#FFF", relief=tk.FLAT, padx=14, command=self._toggle_play)
        self.btn_play.pack(side=tk.LEFT, padx=4)

        btn_next = tk.Button(deck, text="Next ▶", font=("Segoe UI", 9), bg="#334155", fg="#FFF", relief=tk.FLAT, padx=8, command=self._step_fwd)
        btn_next.pack(side=tk.LEFT, padx=3)

        # Scrubber
        self.slider = ttk.Scale(deck, from_=0, to=1, orient=tk.HORIZONTAL, command=self._on_slider)
        self.slider.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=14)

        self.lbl_step_num = tk.Label(deck, text="0 / 0", font=("Consolas", 9), fg="#94A3B8", bg="#0F172A")
        self.lbl_step_num.pack(side=tk.RIGHT)

    def _compute_layout(self):
        w = max(400, self.canvas.winfo_width())
        h = max(300, self.canvas.winfo_height())
        cx = w / 2
        cy = h / 2
        rx = (w - 180) * 0.44
        ry = (h - 140) * 0.40

        self.city_coords = {}
        # City 1 on left
        self.city_coords[1] = (cx - rx, cy)
        # City N on right
        self.city_coords[self.N] = (cx + rx, cy)

        inter_count = self.N - 2
        if inter_count > 0:
            top_count = math.ceil(inter_count / 2)
            bottom_count = inter_count - top_count

            # Top arc
            for i in range(1, top_count + 1):
                city_id = 1 + i
                angle = math.pi + (i / (top_count + 1)) * math.pi
                self.city_coords[city_id] = (cx + rx * math.cos(angle), cy + ry * math.sin(angle))

            # Bottom arc
            for j in range(1, bottom_count + 1):
                city_id = 1 + top_count + j
                angle = math.pi - (j / (bottom_count + 1)) * math.pi
                self.city_coords[city_id] = (cx + rx * math.cos(angle), cy + ry * math.sin(angle))

    def _on_canvas_resize(self):
        self._compute_layout()
        self._render()

    def _solve_and_update(self):
        self.solution = solve_budget_traveller(self.N, self.flights, self.K, self.C)
        self.current_step = 0
        self.anim_hop = 0
        self.anim_t = 0.0

        if self.solution.min_cost == -1:
            self.lbl_status.config(text=f"No route found within {self.K} stops", fg="#EF4444")
        else:
            self.lbl_status.config(text=f"Optimal Path Found! Cost: ${self.solution.min_cost}", fg="#10B981")

        self.slider.config(to=max(1, len(self.solution.path)))
        self._update_path_list()
        self._update_hud()
        self._render()

    def _update_path_list(self):
        self.listbox_path.delete(0, tk.END)
        if not self.solution or not self.solution.path:
            self.listbox_path.insert(tk.END, " No valid path")
            return
        for i, step in enumerate(self.solution.path, 1):
            tag = " [COUPON -50%]" if step.coupon_used else ""
            self.listbox_path.insert(tk.END, f" #{i} {step.flight.u}➔{step.flight.v}: ${step.paid_cost}{tag}")

    def _update_hud(self):
        path = self.solution.path if self.solution else []
        step_idx = self.anim_hop

        running_cost = 0
        stops_used = 0
        coupons_used = 0

        for i in range(min(step_idx, len(path))):
            s = path[i]
            running_cost += s.paid_cost
            if s.coupon_used:
                coupons_used += 1
            if s.flight.v != self.N:
                stops_used += 1

        self.lbl_cost.config(text=f"${running_cost}")
        self.lbl_stops.config(text=f"{stops_used} / {self.K}")
        self.lbl_coupons.config(text=f"{coupons_used} / {self.C}")
        self.lbl_step_num.config(text=f"{step_idx} / {len(path)}")

    def _render(self):
        self.canvas.delete("all")
        w = self.canvas.winfo_width()
        h = self.canvas.winfo_height()
        if w < 10 or h < 10:
            return

        # Background grid dots
        for x in range(0, w, 40):
            for y in range(0, h, 40):
                self.canvas.create_oval(x, y, x + 1, y + 1, fill="#1E293B", outline="")

        path_flight_ids = {s.flight.id: s for s in self.solution.path} if self.solution else {}
        intermediate_stops = {s.flight.v for s in self.solution.path if s.flight.v != self.N} if self.solution else {}

        # 1. Non-path edges
        for f in self.flights:
            if f.id in path_flight_ids:
                continue
            p1 = self.city_coords.get(f.u)
            p2 = self.city_coords.get(f.v)
            if p1 and p2:
                self._draw_flight_arrow(p1, p2, COLOR_EDGE_DEFAULT, width=1.5, price=f.price)

        # 2. Path edges
        if self.solution:
            for s in self.solution.path:
                f = s.flight
                p1 = self.city_coords.get(f.u)
                p2 = self.city_coords.get(f.v)
                if p1 and p2:
                    col = COLOR_COUPON if s.coupon_used else COLOR_PATH
                    width = 4 if s.coupon_used else 3
                    price_str = f"${f.price}➔${s.paid_cost}" if s.coupon_used else f"${f.price}"
                    self._draw_flight_arrow(p1, p2, col, width=width, price=price_str, is_coupon=s.coupon_used)

        # 3. Airplane avatar
        if self.solution and self.anim_hop < len(self.solution.path):
            step = self.solution.path[self.anim_hop]
            p1 = self.city_coords.get(step.flight.u)
            p2 = self.city_coords.get(step.flight.v)
            if p1 and p2:
                t = self.anim_t
                px = (1 - t) * p1[0] + t * p2[0]
                py = (1 - t) * p1[1] + t * p2[1]
                col = COLOR_COUPON if step.coupon_used else COLOR_PATH
                self.canvas.create_oval(px - 14, py - 14, px + 14, py + 14, fill=col, outline="#FFF", width=2)
                self.canvas.create_text(px, py, text="✈", font=("Segoe UI", 12, "bold"), fill="#000")

        # 4. City nodes
        for cid in range(1, self.N + 1):
            coord = self.city_coords.get(cid)
            if not coord:
                continue
            x, y = coord
            rad = 22

            if cid == 1:
                fill_c = COLOR_START
                tag = "START"
            elif cid == self.N:
                fill_c = COLOR_DEST
                tag = "DEST"
            elif cid in intermediate_stops:
                fill_c = COLOR_STOP
                tag = "STOP"
            else:
                fill_c = COLOR_CITY_DEFAULT
                tag = ""

            # Halo
            self.canvas.create_oval(x - rad - 4, y - rad - 4, x + rad + 4, y + rad + 4, outline=fill_c, width=2)
            # Body
            self.canvas.create_oval(x - rad, y - rad, x + rad, y + rad, fill=fill_c, outline="#FFF", width=1.5)
            self.canvas.create_text(x, y, text=str(cid), font=("Segoe UI", 12, "bold"), fill="#FFF")

            if tag:
                self.canvas.create_text(x, y - rad - 12, text=tag, font=("Segoe UI", 8, "bold"), fill=fill_c)

    def _draw_flight_arrow(self, p1, p2, color, width=2, price=None, is_coupon=False):
        x1, y1 = p1
        x2, y2 = p2
        dx = x2 - x1
        dy = y2 - y1
        dist = math.hypot(dx, dy)
        if dist < 1:
            return

        # Truncate at node radius (24px)
        rad = 24
        end_x = x2 - (dx / dist) * rad
        end_y = y2 - (dy / dist) * rad
        start_x = x1 + (dx / dist) * rad
        start_y = y1 + (dy / dist) * rad

        self.canvas.create_line(start_x, start_y, end_x, end_y, fill=color, width=width, arrow=tk.LAST, arrowshape=(12, 14, 5))

        if price is not None:
            mx = (start_x + end_x) / 2
            my = (start_y + end_y) / 2
            txt = str(price)
            bg = "#D97706" if is_coupon else "#1E293B"
            fg = "#FFF" if is_coupon else "#38BDF8"
            self.canvas.create_rectangle(mx - 24, my - 9, mx + 24, my + 9, fill=bg, outline=color, width=1)
            self.canvas.create_text(mx, my, text=txt, font=("Consolas", 8, "bold"), fill=fg)

    def _toggle_play(self):
        if self.is_playing:
            self._pause()
        else:
            self._play()

    def _play(self):
        self.is_playing = True
        self.btn_play.config(text="⏸ Pause", bg="#EF4444")
        self._anim_tick()

    def _pause(self):
        self.is_playing = False
        self.btn_play.config(text="▶ Play", bg="#10B981")
        if self.anim_job:
            self.root.after_cancel(self.anim_job)
            self.anim_job = None

    def _anim_tick(self):
        if not self.is_playing or not self.solution or not self.solution.path:
            return

        self.anim_t += 0.04
        if self.anim_t >= 1.0:
            self.anim_t = 0.0
            self.anim_hop += 1
            self._update_hud()
            self.slider.set(self.anim_hop)

            if self.anim_hop >= len(self.solution.path):
                self._pause()
                self._render()
                return

        self._render()
        self.anim_job = self.root.after(self.speed_ms, self._anim_tick)

    def _reset_playback(self):
        self._pause()
        self.anim_hop = 0
        self.anim_t = 0.0
        self.slider.set(0)
        self._update_hud()
        self._render()

    def _step_back(self):
        self._pause()
        if self.anim_hop > 0:
            self.anim_hop -= 1
            self.anim_t = 0.0
            self.slider.set(self.anim_hop)
            self._update_hud()
            self._render()

    def _step_fwd(self):
        self._pause()
        if self.solution and self.anim_hop < len(self.solution.path):
            self.anim_hop += 1
            self.anim_t = 0.0
            self.slider.set(self.anim_hop)
            self._update_hud()
            self._render()

    def _on_slider(self, val):
        if self.is_playing:
            self._pause()
        self.anim_hop = int(float(val))
        self.anim_t = 0.0
        self._update_hud()
        self._render()

    def _on_solve_clicked(self):
        try:
            self.N = int(self.ent_n.get())
            self.K = int(self.ent_k.get())
            self.C = int(self.ent_c.get())
            self._compute_layout()
            self._solve_and_update()
            self._play()
        except ValueError:
            messagebox.showerror("Error", "Invalid numeric inputs for N, K, or C.")

    def _on_generate_clicked(self):
        try:
            self.N = int(self.ent_n.get())
            self.K = int(self.ent_k.get())
            self.C = int(self.ent_c.get())
            M = max(self.N + 2, int(self.N * 2.2))
            self.flights = generate_valid_graph(self.N, M, self.K)
            self._compute_layout()
            self._solve_and_update()
        except ValueError:
            messagebox.showerror("Error", "Invalid inputs.")

    def _on_load_csv_clicked(self):
        path = filedialog.askopenfilename(filetypes=[("CSV Files", "*.csv"), ("All Files", "*.*")])
        if path:
            N, flights = read_flights_from_csv(path)
            self.N = N
            self.ent_n.delete(0, tk.END)
            self.ent_n.insert(0, str(N))
            self.flights = flights
            self._compute_layout()
            self._solve_and_update()

    def _export_csv(self):
        if not self.solution or self.solution.min_cost == -1:
            messagebox.showwarning("Warning", "No valid path to export.")
            return
        path = filedialog.asksaveasfilename(defaultextension=".csv", initialfile="budget_traveller_solution.csv",
                                            filetypes=[("CSV Files", "*.csv")])
        if path:
            export_solution_csv(path, self.flights, self.solution.path)
            messagebox.showinfo("Success", f"Exported solution to:\n{path}")

    def _on_mouse_down(self, event):
        for cid, (x, y) in self.city_coords.items():
            if math.hypot(event.x - x, event.y - y) <= 25:
                self.dragged_node = cid
                self.drag_offset = (event.x - x, event.y - y)
                break

    def _on_mouse_drag(self, event):
        if self.dragged_node:
            ox, oy = self.drag_offset
            self.city_coords[self.dragged_node] = (event.x - ox, event.y - oy)
            self._render()

    def _on_mouse_up(self, event):
        self.dragged_node = None


def launch_gui(N: int = 5, K: int = 2, C: int = 1, flights: Optional[List[Flight]] = None):
    root = tk.Tk()
    app = TravellerVisualizerGUI(root, N=N, K=K, C=C, flights=flights)
    root.mainloop()


if __name__ == '__main__':
    launch_gui()
