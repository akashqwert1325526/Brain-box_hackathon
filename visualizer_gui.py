"""
Tkinter Native Desktop Visualizer for Maze with Keys and Doors
Features:
- Color-coded grid (White open, Black wall, Green start, Red exit, distinct colors per key/door pair)
- Animated key pick-ups (key disappears, inventory panel updates)
- Animated door openings (door turns to white with unlock mark 🔓)
- Path highlighting with smooth step-by-step playback
- Full interactive controls: Play, Pause, Step, Reset, Speed Slider, Load CSV, Generate Maze, Export CSV
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import time
from typing import List, Tuple, Dict, Optional
from maze_engine import MazeSolver, generate_solvable_maze, COLOR_PALETTE


KEY_DOOR_COLORS = {
    'a': '#F59E0B', 'A': '#F59E0B',  # Amber
    'b': '#06B6D4', 'B': '#06B6D4',  # Cyan
    'c': '#8B5CF6', 'C': '#8B5CF6',  # Purple
    'd': '#EC4899', 'D': '#EC4899',  # Rose/Pink
    'e': '#F97316', 'E': '#F97316',  # Orange
    'f': '#3B82F6', 'F': '#3B82F6',  # Blue
}

COLOR_OPEN = "#FFFFFF"
COLOR_WALL = "#18181B"
COLOR_START = "#10B981"
COLOR_EXIT = "#EF4444"
COLOR_PATH = "#FEF08A"       # Soft yellow highlight
COLOR_AGENT = "#6366F1"      # Indigo agent


class MazeVisualizerGUI:
    def __init__(self, root: tk.Tk, grid: Optional[List[List[str]]] = None, T: int = 3):
        self.root = root
        self.root.title("Problem 1: Maze with Keys and Doors - Visualizer")
        self.root.geometry("1100x820")
        self.root.minsize(950, 700)
        self.root.configure(bg="#0F172A")

        self.T = T
        self.grid = grid
        self.solver = None
        self.path_coords = []
        self.step_details = []
        self.shortest_length = -1

        # Playback state
        self.current_step = 0
        self.is_playing = False
        self.animation_job = None
        self.speed_ms = 180

        # Dynamic state during animation
        self.active_keys_on_grid = set()   # (r, c)
        self.unlocked_doors = set()        # (r, c)
        self.held_keys = set()             # set of key characters
        self.visited_path = []             # list of (r, c)

        self._setup_ui()

        if self.grid:
            self._load_grid(self.grid, self.T)
        else:
            self._generate_random_maze()

    def _setup_ui(self):
        # 1. Top Control Bar (Dark Glassmorphic style)
        control_frame = tk.Frame(self.root, bg="#1E293B", pady=8, padx=12)
        control_frame.pack(fill=tk.X, side=tk.TOP)

        # Title Label
        title_lbl = tk.Label(
            control_frame, text="Maze Keys & Doors Solver",
            font=("Segoe UI", 13, "bold"), fg="#F8FAFC", bg="#1E293B"
        )
        title_lbl.pack(side=tk.LEFT, padx=(0, 20))

        # T selector
        tk.Label(control_frame, text="T (Keys):", font=("Segoe UI", 9, "bold"), fg="#94A3B8", bg="#1E293B").pack(side=tk.LEFT, padx=2)
        self.t_var = tk.IntVar(value=self.T)
        t_spin = ttk.Spinbox(control_frame, from_=1, to=6, width=3, textvariable=self.t_var)
        t_spin.pack(side=tk.LEFT, padx=4)

        # N selector
        tk.Label(control_frame, text="N (Grid):", font=("Segoe UI", 9, "bold"), fg="#94A3B8", bg="#1E293B").pack(side=tk.LEFT, padx=(10, 2))
        self.n_var = tk.IntVar(value=15)
        n_spin = ttk.Spinbox(control_frame, from_=7, to=35, width=4, textvariable=self.n_var)
        n_spin.pack(side=tk.LEFT, padx=4)

        # Action Buttons
        btn_gen = tk.Button(
            control_frame, text="🎲 Generate Solvable", command=self._generate_random_maze,
            font=("Segoe UI", 9, "bold"), bg="#3B82F6", fg="#FFFFFF", relief=tk.FLAT, padx=10, pady=4, cursor="hand2"
        )
        btn_gen.pack(side=tk.LEFT, padx=6)

        btn_load = tk.Button(
            control_frame, text="📂 Load CSV", command=self._open_csv_file,
            font=("Segoe UI", 9), bg="#334155", fg="#FFFFFF", relief=tk.FLAT, padx=8, pady=4, cursor="hand2"
        )
        btn_load.pack(side=tk.LEFT, padx=4)

        btn_export = tk.Button(
            control_frame, text="💾 Export Solution CSV", command=self._export_csv_file,
            font=("Segoe UI", 9), bg="#059669", fg="#FFFFFF", relief=tk.FLAT, padx=8, pady=4, cursor="hand2"
        )
        btn_export.pack(side=tk.LEFT, padx=4)

        # 2. Key Inventory & Status Panel (Prominent HUD)
        hud_frame = tk.Frame(self.root, bg="#0F172A", pady=6, padx=16)
        hud_frame.pack(fill=tk.X, side=tk.TOP)

        inv_label = tk.Label(hud_frame, text="KEY INVENTORY:", font=("Segoe UI", 10, "bold"), fg="#94A3B8", bg="#0F172A")
        inv_label.pack(side=tk.LEFT, padx=(0, 8))

        # Inventory Badges for keys a-f
        self.key_badges = {}
        for i in range(6):
            char = chr(ord('a') + i)
            badge = tk.Label(
                hud_frame, text=f"🔑 {char}", font=("Segoe UI", 9, "bold"),
                fg="#64748B", bg="#1E293B", width=7, relief=tk.GROOVE, padx=4, pady=2
            )
            badge.pack(side=tk.LEFT, padx=3)
            self.key_badges[char] = badge

        # Metrics display on right
        self.status_lbl = tk.Label(
            hud_frame, text="Path: -- | Step: 0/0",
            font=("Segoe UI", 10, "bold"), fg="#38BDF8", bg="#0F172A"
        )
        self.status_lbl.pack(side=tk.RIGHT, padx=10)

        # 3. Canvas for Grid Display
        canvas_container = tk.Frame(self.root, bg="#0F172A", padx=16, pady=6)
        canvas_container.pack(fill=tk.BOTH, expand=True)

        self.canvas = tk.Canvas(canvas_container, bg="#020617", highlightthickness=1, highlightbackground="#334155")
        self.canvas.pack(fill=tk.BOTH, expand=True)
        self.canvas.bind("<Configure>", lambda event: self._redraw())

        # 4. Bottom Playback Control Bar
        play_frame = tk.Frame(self.root, bg="#1E293B", pady=8, padx=16)
        play_frame.pack(fill=tk.X, side=tk.BOTTOM)

        self.btn_reset = tk.Button(
            play_frame, text="⏮ Reset", command=self._reset_playback,
            font=("Segoe UI", 9, "bold"), bg="#475569", fg="#FFFFFF", relief=tk.FLAT, padx=10, pady=3, cursor="hand2"
        )
        self.btn_reset.pack(side=tk.LEFT, padx=4)

        self.btn_step_back = tk.Button(
            play_frame, text="◀ Step Back", command=self._step_backward,
            font=("Segoe UI", 9), bg="#475569", fg="#FFFFFF", relief=tk.FLAT, padx=10, pady=3, cursor="hand2"
        )
        self.btn_step_back.pack(side=tk.LEFT, padx=4)

        self.btn_play = tk.Button(
            play_frame, text="▶ Play", command=self._toggle_play,
            font=("Segoe UI", 9, "bold"), bg="#10B981", fg="#FFFFFF", relief=tk.FLAT, padx=14, pady=3, cursor="hand2"
        )
        self.btn_play.pack(side=tk.LEFT, padx=4)

        self.btn_step_forward = tk.Button(
            play_frame, text="Step Forward ▶", command=self._step_forward,
            font=("Segoe UI", 9), bg="#475569", fg="#FFFFFF", relief=tk.FLAT, padx=10, pady=3, cursor="hand2"
        )
        self.btn_step_forward.pack(side=tk.LEFT, padx=4)

        # Step Slider
        self.slider_var = tk.IntVar(value=0)
        self.slider = ttk.Scale(
            play_frame, from_=0, to=100, orient=tk.HORIZONTAL,
            variable=self.slider_var, command=self._on_slider_change
        )
        self.slider.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=14)

        # Speed Control
        tk.Label(play_frame, text="Speed:", font=("Segoe UI", 9), fg="#94A3B8", bg="#1E293B").pack(side=tk.LEFT, padx=(10, 2))
        self.speed_var = tk.StringVar(value="Normal")
        speed_menu = ttk.Combobox(play_frame, textvariable=self.speed_var, values=["Slow", "Normal", "Fast", "Ultra"], width=7, state="readonly")
        speed_menu.pack(side=tk.LEFT, padx=4)
        speed_menu.bind("<<ComboboxSelected>>", self._on_speed_change)

        # Legend indicator on right
        legend_lbl = tk.Label(
            play_frame, text="Green: Start | Red: Exit | 🔓 Unlocked",
            font=("Segoe UI", 8), fg="#94A3B8", bg="#1E293B"
        )
        legend_lbl.pack(side=tk.RIGHT, padx=6)

    def _on_speed_change(self, event=None):
        val = self.speed_var.get()
        if val == "Slow":
            self.speed_ms = 400
        elif val == "Normal":
            self.speed_ms = 180
        elif val == "Fast":
            self.speed_ms = 80
        elif val == "Ultra":
            self.speed_ms = 25

    def _open_csv_file(self):
        filepath = filedialog.askopenfilename(
            title="Open Maze CSV",
            filetypes=[("CSV Files", "*.csv"), ("All Files", "*.*")]
        )
        if not filepath:
            return
        try:
            import csv
            grid = []
            with open(filepath, 'r', encoding='utf-8') as f:
                reader = csv.reader(f)
                for row in reader:
                    cleaned = [c.strip() for c in row if c.strip() != '']
                    if cleaned:
                        grid.append(cleaned)
            if not grid:
                raise ValueError("CSV is empty!")
            self._load_grid(grid, self.t_var.get())
        except Exception as e:
            messagebox.showerror("Error Loading CSV", str(e))

    def _export_csv_file(self):
        if not self.solver or self.shortest_length == -1:
            messagebox.showwarning("Export Failed", "No valid solution path to export!")
            return
        filepath = filedialog.asksaveasfilename(
            title="Save Solution CSV",
            defaultextension=".csv",
            filetypes=[("CSV Files", "*.csv")]
        )
        if not filepath:
            return
        try:
            marked = self.solver.get_marked_grid(self.path_coords)
            self.solver.export_solution_csv(filepath, marked)
            messagebox.showinfo("Export Successful", f"Saved marked solution to:\n{filepath}")
        except Exception as e:
            messagebox.showerror("Export Error", str(e))

    def _generate_random_maze(self):
        self._stop_animation()
        N = max(7, self.n_var.get())
        T = max(1, min(6, self.t_var.get()))
        grid, _ = generate_solvable_maze(N, T)
        self._load_grid(grid, T)

    def _load_grid(self, grid: List[List[str]], T: int):
        self._stop_animation()
        self.grid = grid
        self.T = T
        self.t_var.set(T)
        self.n_var.set(len(grid))

        try:
            self.solver = MazeSolver(self.grid, T=self.T)
            self.shortest_length, self.path_coords, self.step_details = self.solver.solve()
        except Exception as e:
            messagebox.showerror("Solver Error", str(e))
            return

        self.slider.configure(to=len(self.path_coords) - 1 if self.path_coords else 0)
        self._reset_playback()

    def _reset_playback(self):
        self._stop_animation()
        self.current_step = 0
        self.slider_var.set(0)
        self._update_state_at_step(0)
        self._redraw()

    def _toggle_play(self):
        if self.is_playing:
            self._stop_animation()
        else:
            if self.shortest_length == -1:
                messagebox.showinfo("Unsolvable", "Maze has no valid path from S to E!")
                return
            if self.current_step >= len(self.path_coords) - 1:
                self.current_step = 0
            self.is_playing = True
            self.btn_play.configure(text="⏸ Pause", bg="#EAB308")
            self._run_animation_loop()

    def _stop_animation(self):
        self.is_playing = False
        if self.animation_job:
            self.root.after_cancel(self.animation_job)
            self.animation_job = None
        self.btn_play.configure(text="▶ Play", bg="#10B981")

    def _run_animation_loop(self):
        if not self.is_playing:
            return
        if self.current_step < len(self.path_coords) - 1:
            self.current_step += 1
            self.slider_var.set(self.current_step)
            self._update_state_at_step(self.current_step)
            self._redraw()
            self.animation_job = self.root.after(self.speed_ms, self._run_animation_loop)
        else:
            self._stop_animation()

    def _step_forward(self):
        self._stop_animation()
        if self.current_step < len(self.path_coords) - 1:
            self.current_step += 1
            self.slider_var.set(self.current_step)
            self._update_state_at_step(self.current_step)
            self._redraw()

    def _step_backward(self):
        self._stop_animation()
        if self.current_step > 0:
            self.current_step -= 1
            self.slider_var.set(self.current_step)
            self._update_state_at_step(self.current_step)
            self._redraw()

    def _on_slider_change(self, val):
        if not self.is_playing and self.path_coords:
            step = int(float(val))
            if step != self.current_step:
                self.current_step = step
                self._update_state_at_step(self.current_step)
                self._redraw()

    def _update_state_at_step(self, step_idx: int):
        """Updates inventory, unlocked doors, and keys present on grid at step_idx."""
        # Reset dynamic states
        self.held_keys = set()
        self.unlocked_doors = set()
        self.visited_path = self.path_coords[:step_idx + 1] if self.path_coords else []

        if self.step_details and step_idx < len(self.step_details):
            detail = self.step_details[step_idx]
            self.held_keys = set(detail['held_keys'])
            self.unlocked_doors = set()
            # Mark all doors traversed up to step_idx as unlocked
            for i in range(step_idx + 1):
                d = self.step_details[i].get('door_unlocked')
                if d:
                    self.unlocked_doors.add((self.step_details[i]['r'], self.step_details[i]['c']))

        # Update HUD Inventory Badges
        for char, badge in self.key_badges.items():
            if char in self.held_keys:
                badge_color = KEY_DOOR_COLORS.get(char, "#F59E0B")
                badge.configure(bg=badge_color, fg="#FFFFFF", relief=tk.RAISED, text=f"🔑 {char} ✓")
            else:
                badge.configure(bg="#1E293B", fg="#64748B", relief=tk.GROOVE, text=f"🔑 {char}")

        # Update status text
        total_steps = len(self.path_coords) - 1 if self.path_coords else 0
        if self.shortest_length != -1:
            msg = f"Path: {self.shortest_length} steps | Step: {step_idx}/{total_steps}"
            if self.step_details and step_idx < len(self.step_details):
                ev = self.step_details[step_idx]
                if ev['key_picked']:
                    msg += f" | 🔑 Picked up key '{ev['key_picked']}'!"
                elif ev['door_unlocked']:
                    msg += f" | 🔓 Unlocked door '{ev['door_unlocked']}'!"
            self.status_lbl.configure(text=msg, fg="#38BDF8")
        else:
            self.status_lbl.configure(text="No Solvable Path Found (-1)", fg="#EF4444")

    def _redraw(self):
        self.canvas.delete("all")
        if not self.grid:
            return

        rows = len(self.grid)
        cols = len(self.grid[0])
        w = self.canvas.winfo_width()
        h = self.canvas.winfo_height()

        if w < 10 or h < 10:
            return

        pad = 20
        available_w = w - 2 * pad
        available_h = h - 2 * pad

        cell_size = min(available_w // cols, available_h // rows)
        if cell_size < 4:
            cell_size = 4

        grid_w = cols * cell_size
        grid_h = rows * cell_size
        offset_x = pad + (available_w - grid_w) // 2
        offset_y = pad + (available_h - grid_h) // 2

        visited_set = set(self.visited_path)
        agent_pos = self.path_coords[self.current_step] if (self.path_coords and self.current_step < len(self.path_coords)) else None

        # Draw cells
        for r in range(rows):
            for c in range(cols):
                x1 = offset_x + c * cell_size
                y1 = offset_y + r * cell_size
                x2 = x1 + cell_size
                y2 = y1 + cell_size

                val = self.grid[r][c].strip()
                cell_color = COLOR_OPEN
                text = ""
                text_color = "#000000"

                if val == '#':
                    cell_color = COLOR_WALL
                elif val == 'S':
                    cell_color = COLOR_START
                    text = "S"
                    text_color = "#FFFFFF"
                elif val == 'E':
                    cell_color = COLOR_EXIT
                    text = "E"
                    text_color = "#FFFFFF"
                elif 'a' <= val <= 'f':
                    # Key cell: check if key has been collected up to current step
                    if val in self.held_keys:
                        # Key picked up -> key disappears! Turns to open / path color
                        cell_color = COLOR_PATH if (r, c) in visited_set else COLOR_OPEN
                        text = "·"  # Disappeared, empty ground
                        text_color = "#94A3B8"
                    else:
                        cell_color = KEY_DOOR_COLORS.get(val, "#F59E0B")
                        text = val
                        text_color = "#FFFFFF"
                elif 'A' <= val <= 'F':
                    # Door cell: check if door is unlocked
                    if (r, c) in self.unlocked_doors:
                        # Door turns from its color to white with an unlock mark 🔓
                        cell_color = "#FFFFFF"
                        text = "🔓"
                        text_color = "#059669"
                    else:
                        cell_color = KEY_DOOR_COLORS.get(val, "#F59E0B")
                        text = val
                        text_color = "#FFFFFF"

                # If open cell is part of visited path, highlight it
                if val == '.' and (r, c) in visited_set:
                    cell_color = COLOR_PATH

                # Draw cell rectangle
                self.canvas.create_rectangle(
                    x1, y1, x2, y2,
                    fill=cell_color, outline="#334155" if val != '#' else "#0F172A", width=1
                )

                # Draw label if cell size is reasonable
                if text and cell_size >= 14:
                    font_size = max(8, int(cell_size * 0.45))
                    self.canvas.create_text(
                        (x1 + x2) / 2, (y1 + y2) / 2,
                        text=text, fill=text_color, font=("Segoe UI", font_size, "bold")
                    )

        # Draw path connection lines
        if len(self.visited_path) > 1 and cell_size >= 6:
            line_coords = []
            for (pr, pc) in self.visited_path:
                cx = offset_x + pc * cell_size + cell_size / 2
                cy = offset_y + pr * cell_size + cell_size / 2
                line_coords.extend([cx, cy])
            if len(line_coords) >= 4:
                self.canvas.create_line(line_coords, fill="#F59E0B", width=max(2, int(cell_size * 0.18)), joinstyle=tk.ROUND, capstyle=tk.ROUND)

        # Draw agent avatar at current step
        if agent_pos:
            ar, ac = agent_pos
            cx = offset_x + ac * cell_size + cell_size / 2
            cy = offset_y + ar * cell_size + cell_size / 2
            rad = max(3, cell_size * 0.38)
            # Glowing halo
            self.canvas.create_oval(
                cx - rad - 2, cy - rad - 2, cx + rad + 2, cy + rad + 2,
                outline="#38BDF8", width=2
            )
            # Agent core
            self.canvas.create_oval(
                cx - rad, cy - rad, cx + rad, cy + rad,
                fill=COLOR_AGENT, outline="#FFFFFF", width=1.5
            )


def launch_gui(grid: Optional[List[List[str]]] = None, solver: Optional[MazeSolver] = None,
               path_coords: Optional[List[Tuple[int, int]]] = None, step_details: Optional[List[Dict]] = None):
    root = tk.Tk()
    app = MazeVisualizerGUI(root, grid=grid, T=solver.T if solver else 3)
    if solver and path_coords:
        app.solver = solver
        app.path_coords = path_coords
        app.step_details = step_details
        app.shortest_length = len(path_coords) - 1
        app.slider.configure(to=len(path_coords) - 1)
        app._reset_playback()
    root.mainloop()


if __name__ == '__main__':
    launch_gui()
