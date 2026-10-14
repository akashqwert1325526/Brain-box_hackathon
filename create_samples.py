"""
Generate sample mazes for testing and demonstration
"""
import csv
from maze_engine import generate_solvable_maze, MazeSolver

def create_samples():
    # 1. Handcrafted intuitive small maze (7x7)
    # Legend:
    # S = Start (0,0)
    # E = Exit (6,6)
    # a = Key at (0,6)
    # A = Door at (5,5) blocking access to Exit
    small_maze = [
        ['S', '.', '.', '#', '.', '.', 'a'],
        ['#', '#', '.', '#', '.', '#', '#'],
        ['.', '.', '.', '.', '.', '.', '.'],
        ['.', '#', '#', '#', '#', '#', '.'],
        ['.', '.', '.', '.', '.', '.', '.'],
        ['#', '#', '#', '#', '#', 'A', '#'],
        ['.', '.', '.', '.', '.', '.', 'E']
    ]
    with open("sample_maze_small.csv", "w", newline='', encoding='utf-8') as f:
        csv.writer(f).writerows(small_maze)
    print("Created sample_maze_small.csv")

    # 2. Solvable 15x15 maze with T=3 keys and doors
    grid_15, len_15 = generate_solvable_maze(15, T=3)
    with open("sample_maze_multikey.csv", "w", newline='', encoding='utf-8') as f:
        csv.writer(f).writerows(grid_15)
    print(f"Created sample_maze_multikey.csv (Length: {len_15})")

    # 3. Solvable 21x21 maze with T=5 keys and doors
    grid_21, len_21 = generate_solvable_maze(21, T=5)
    with open("sample_maze_large.csv", "w", newline='', encoding='utf-8') as f:
        csv.writer(f).writerows(grid_21)
    print(f"Created sample_maze_large.csv (Length: {len_21})")

if __name__ == '__main__':
    create_samples()
