# Problem 1: Maze with Keys and Doors

A complete solution, BFS Bitmask solver, solvable maze generator, and dual-mode interactive visualizer (Native Desktop GUI + Web App) for the **Maze with Keys and Doors** challenge.

---

## 📋 Problem Description

Given an $N \times N$ grid where:
- `.` = Open cell
- `#` = Wall
- `S` = Starting position
- `E` = Exit destination
- `a` – `f` = Keys (up to $T$ distinct keys, $1 \le T \le 6$)
- `A` – `F` = Doors (matching keys `a` – `f`)

**Rules**:
1. You may move up, down, left, or right, 1 cell per step.
2. Stepping on a key cell picks up that key automatically (keys are never consumed).
3. A door can only be entered if holding the matching key.
4. Objective: Find the shortest path length from `S` to `E`, or return `-1` if unsolvable.

---

## 🚀 Quick Start

### 1. Interactive CLI (Exact Prompt Specification)
Run the main script without arguments to follow the interactive input prompt:
```bash
python maze_solver.py
```
**Prompts**:
1. `T`: Number of key/door pairs ($1 \le T \le 6$)
2. `Option 1`: Read $N \times N$ grid from a CSV file (e.g. `sample_maze_small.csv`, `sample_maze_multikey.csv`)
3. `Option 2`: Generate a valid, solvable $N \times N$ maze randomly
4. **Output 1**: Single integer shortest path length (or `-1`)
5. **Output 2**: Exported `maze_solution.csv` with path cells marked with `'x'` (while keeping collected keys `x(a)` and unlocked doors `x(A)` clearly identifiable)
6. **Visualization**: Choose to launch the Native Tkinter Desktop Visualizer or Modern Web Visualizer.

### 2. Command Line Flags (Automated / Batch Mode)
```bash
# Option 1: Solve from CSV
python maze_solver.py --T 3 --input sample_maze_multikey.csv --output my_solution.csv

# Option 2: Generate solvable 15x15 maze with T=3 keys and doors
python maze_solver.py --T 3 --generate 15 --output my_solution.csv

# Launch native Tkinter desktop visualizer directly
python maze_solver.py --gui

# Open modern web visualizer in default browser
python maze_solver.py --web
```

### 3. Open Modern Web Visualizer
Simply double-click `index.html` or open it in any web browser:
```bash
# Windows
start index.html
```

---

## 🎨 Visualization Features

Both the native GUI and the modern web application adhere to all visual guidelines:
- **Color Coding**:
  - **White**: Open cell (`.`)
  - **Black**: Wall (`#`)
  - **Green**: Start (`S`)
  - **Red**: Exit (`E`)
  - **Distinct Colors per Key/Door Pair**:
    - Pair 1 (`a` / `A`): **Amber** (`#F59E0B`)
    - Pair 2 (`b` / `B`): **Cyan** (`#06B6D4`)
    - Pair 3 (`c` / `C`): **Purple** (`#8B5CF6`)
    - Pair 4 (`d` / `D`): **Rose** (`#F43F5E`)
    - Pair 5 (`e` / `E`): **Orange** (`#F97316`)
    - Pair 6 (`f` / `F`): **Blue** (`#3B82F6`)
- **Key Pickup Animation**: Stepping on a key cell makes the key disappear from the maze and updates the **Key Inventory HUD** panel with glowing badge state and sound chime!
- **Door Opening Animation**: When passing through a door, the door turns from its color to **white** with an unlock mark `🔓`!
- **Path Highlighting**: Traces the agent's path with breadcrumb trail and connector lines.
- **Interactive Controls**: Play, Pause, Step Forward, Step Backward, Timeline Slider, Speed selector (0.5x to 10x), CSV Drag-and-Drop, and Instant Solvable Maze Generator.

---

## 🧠 Algorithm & Time Complexity

- **State Representation**: $(r, c, \text{mask})$ where $\text{mask} \in [0, 2^T - 1]$.
  - Since $T \le 6$, $2^T \le 64$.
- **Graph Search**: Breadth-First Search (BFS) guarantees finding the optimal shortest path in $O(N^2 \cdot 2^T)$ time and space.
  - For $N = 30, T = 6$: Maximum states $= 30 \times 30 \times 64 = 57,600$, solved in **< 15 milliseconds**!
- **Guaranteed Solvability Generator**: Uses randomized corridor carving with progressive distance tiering for keys and doors, verified by the bitmask BFS solver.

---

## 📁 Repository Structure

| File | Description |
|---|---|
| `maze_engine.py` | Core BFS Bitmask algorithm and Solvable Maze Generator |
| `maze_solver.py` | CLI interface supporting Option 1 (CSV), Option 2 (Random), Outputs 1 & 2, and launcher |
| `visualizer_gui.py` | Native Tkinter desktop visualizer (pure Python standard library) |
| `index.html` | Modern responsive Web Visualizer UI with glassmorphism |
| `styles.css` | Design system, animations, dark mode, and HUD layout |
| `app.js` | Client-side BFS solver, canvas renderer, and Web Audio synthesizer |
| `traveller.js` | Web interactive graph visualizer & multi-state Dijkstra engine |
| `traveller_solver.py` | Python CLI & solver for Problem 3 with CSV export & launchers |
| `traveller_gui.py` | Native Tkinter desktop graph visualizer for Problem 3 |
| `BudgetTraveller.java` | Java core solver and CLI for Problem 3 |
| `README_PROBLEM3.md` | Problem 3 specification, algorithm, and visualizer guide |
| `sample_flights.csv` | Sample flights network dataset |
| `generated_flights.csv` | Solvable 5-city flights network demonstrating coupon halving |
