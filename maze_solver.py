"""
Maze Solver with Keys and Doors - Command Line Interface
Adheres strictly to Problem 1 specification:
- Input T (1 <= T <= 6)
- Option 1: Read NxN grid from CSV
- Option 2: Generate NxN grid randomly (guaranteed solvable)
- Output 1: Single integer shortest path length, or -1
- Output 2: CSV file with shortest path marked with 'x's
- Visualization launcher (Tkinter Desktop GUI or Browser)
"""

import sys
import os
import csv
import argparse
from typing import List
from maze_engine import MazeSolver, generate_solvable_maze, COLOR_PALETTE


def read_grid_from_csv(filepath: str) -> List[List[str]]:
    """Reads N x N grid from a CSV file."""
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"CSV file not found: {filepath}")

    grid = []
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        for row in reader:
            if not row:
                continue
            # Clean each cell
            cleaned_row = [cell.strip() for cell in row if cell.strip() != '']
            if cleaned_row:
                grid.append(cleaned_row)

    if not grid:
        raise ValueError("CSV file is empty or formatted incorrectly.")
    return grid


def print_colored_grid(grid: List[List[str]], marked_grid: List[List[str]] = None):
    """Prints a terminal preview with ANSI colors if supported."""
    display = marked_grid if marked_grid else grid
    print("\n--- Maze Preview ---")
    for r in range(len(display)):
        row_str = []
        for c in range(len(display[r])):
            cell = display[r][c]
            # Compact 3-char cell
            if len(cell) == 1:
                row_str.append(f" {cell} ")
            elif len(cell) == 4:  # e.g. x(a)
                row_str.append(f"{cell}")
            else:
                row_str.append(f"{cell:^4}")
        print("".join(row_str))
    print("--------------------\n")


def interactive_cli():
    print("=" * 60)
    print("      PROBLEM 1: MAZE WITH KEYS AND DOORS SOLVER      ")
    print("=" * 60)

    # 1. Standard input line: T
    while True:
        try:
            t_input = input("Enter T (number of distinct key/door types, 1 <= T <= 6): ").strip()
            T = int(t_input)
            if 1 <= T <= 6:
                break
            print("Please enter an integer between 1 and 6.")
        except ValueError:
            print("Invalid input. Please enter a number between 1 and 6.")

    # 2. Options
    print("\nSelect Input Option:")
    print("  [1] Read NxN grid from a CSV file")
    print("  [2] Generate NxN grid randomly (guaranteed solvable)")
    
    choice = ""
    while choice not in ['1', '2']:
        choice = input("Enter option (1 or 2): ").strip()

    grid = None
    if choice == '1':
        csv_path = input("Enter path to CSV file (e.g. sample_maze.csv): ").strip()
        try:
            grid = read_grid_from_csv(csv_path)
            print(f"Loaded {len(grid)}x{len(grid[0])} maze from {csv_path}")
        except Exception as e:
            print(f"Error loading CSV: {e}")
            return
    else:
        # Option 2: Random generation
        while True:
            try:
                n_input = input("Enter grid size N (e.g. 15, minimum 7): ").strip()
                N = int(n_input)
                if N >= 7:
                    break
                print("N should be at least 7 for a valid solvable maze with keys.")
            except ValueError:
                print("Invalid input. Please enter an integer >= 7.")
        
        print(f"Generating random solvable {N}x{N} maze with T={T} keys and doors...")
        grid, expected_len = generate_solvable_maze(N, T)
        raw_csv_path = "generated_maze.csv"
        with open(raw_csv_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerows(grid)
        print(f"Generated maze saved to: {raw_csv_path}")

    # Solve the maze
    solver = MazeSolver(grid, T=T)
    shortest_path_len, path_coords, step_details = solver.solve()

    # Output 1: Single integer shortest path length, or -1 if not possible
    print("\n" + "=" * 40)
    print(f"OUTPUT 1: Shortest Path Length = {shortest_path_len}")
    print("=" * 40)

    # Output 2: CSV file with shortest path marked with 'x's
    out_csv_path = "maze_solution.csv"
    if shortest_path_len != -1:
        marked_grid = solver.get_marked_grid(path_coords)
        solver.export_solution_csv(out_csv_path, marked_grid)
        print(f"OUTPUT 2: Solution marked CSV saved to: {os.path.abspath(out_csv_path)}")
        print_colored_grid(grid, marked_grid)
        
        # Summary of keys picked and doors opened
        keys_picked = [d['key_picked'] for d in step_details if d['key_picked']]
        doors_opened = [d['door_unlocked'] for d in step_details if d['door_unlocked']]
        print(f"Keys collected along path: {keys_picked if keys_picked else 'None'}")
        print(f"Doors unlocked along path: {doors_opened if doors_opened else 'None'}")
    else:
        print("Maze is unsolvable! Output CSV cannot mark a valid path.")

    # Visualization Option
    print("\nVisualization:")
    print("  [1] Launch Tkinter Desktop Visualizer (Native GUI)")
    print("  [2] Open Modern Web Visualizer in Browser")
    print("  [3] Exit")
    vis_choice = input("Enter choice (1, 2, or 3): ").strip()

    if vis_choice == '1':
        try:
            from visualizer_gui import launch_gui
            launch_gui(grid=grid, solver=solver, path_coords=path_coords, step_details=step_details)
        except Exception as e:
            print(f"Could not launch Tkinter GUI: {e}")
    elif vis_choice == '2':
        import webbrowser
        html_path = os.path.abspath("index.html")
        print(f"Opening {html_path} in your browser...")
        webbrowser.open(f"file:///{html_path}")


def main():
    parser = argparse.ArgumentParser(description="Maze with Keys and Doors Solver")
    parser.add_argument("--T", type=int, default=None, help="Number of distinct key/door types (1-6)")
    parser.add_argument("--input", "-i", type=str, default=None, help="Input CSV maze file")
    parser.add_argument("--generate", "-g", type=int, default=None, help="Generate random N x N maze")
    parser.add_argument("--output", "-o", type=str, default="maze_solution.csv", help="Output solution CSV path")
    parser.add_argument("--gui", action="store_true", help="Launch native Tkinter desktop visualizer")
    parser.add_argument("--web", action="store_true", help="Open web visualizer in default browser")

    args = parser.parse_args()

    # If no flags provided, run interactive CLI
    if args.T is None and args.input is None and args.generate is None and not args.gui and not args.web:
        interactive_cli()
        return

    T = args.T if args.T is not None else 6
    T = max(1, min(6, T))

    grid = None
    if args.input:
        grid = read_grid_from_csv(args.input)
    elif args.generate:
        grid, _ = generate_solvable_maze(args.generate, T)
        with open("generated_maze.csv", 'w', newline='', encoding='utf-8') as f:
            csv.writer(f).writerows(grid)
        print(f"Saved generated maze to generated_maze.csv")
    else:
        # Default fallback sample
        grid, _ = generate_solvable_maze(15, T)

    solver = MazeSolver(grid, T=T)
    length, path_coords, step_details = solver.solve()
    print(f"OUTPUT 1: {length}")

    if length != -1:
        marked_grid = solver.get_marked_grid(path_coords)
        solver.export_solution_csv(args.output, marked_grid)
        print(f"OUTPUT 2: Solution written to {args.output}")

    if args.gui:
        from visualizer_gui import launch_gui
        launch_gui(grid=grid, solver=solver, path_coords=path_coords, step_details=step_details)
    elif args.web:
        import webbrowser
        webbrowser.open(f"file:///{os.path.abspath('index.html')}")


if __name__ == '__main__':
    main()
