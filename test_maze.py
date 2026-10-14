"""
Unit tests for Maze Engine
"""
import unittest
from maze_engine import MazeSolver, generate_solvable_maze

class TestMazeSolver(unittest.TestCase):

    def test_simple_key_door(self):
        # S . a #
        # # . # #
        # A . . E
        # # # # #
        grid = [
            ['S', '.', 'a', '#'],
            ['#', '.', '#', '#'],
            ['A', '.', '.', 'E'],
            ['#', '#', '#', '#']
        ]
        # Path: S(0,0) -> (0,1) -> (0,2)[key a] -> (0,1) -> (1,1) -> (2,1) -> (2,2) -> (2,3)[E]
        # Wait, A is at (2,0), path doesn't even need door A here!
        solver = MazeSolver(grid, T=1)
        length, path, details = solver.solve()
        self.assertGreater(length, 0)
        self.assertEqual(path[0], (0, 0))
        self.assertEqual(path[-1], (2, 3))

    def test_door_blocking_exit(self):
        # S a #
        # . # #
        # . A E
        grid = [
            ['S', 'a', '#'],
            ['.', '#', '#'],
            ['.', 'A', 'E']
        ]
        # Must pick 'a' at (0,1) then backtrack to (0,0) -> (1,0) -> (2,0) -> (2,1)[open door A] -> (2,2)[E]
        # Steps: (0,0) -> (0,1)[a] -> (0,0) -> (1,0) -> (2,0) -> (2,1)[A] -> (2,2)[E]
        # Path length = 6 steps
        solver = MazeSolver(grid, T=1)
        length, path, details = solver.solve()
        self.assertEqual(length, 6)
        # Check that door A was unlocked and key a was picked up
        unlocked = [d['door_unlocked'] for d in details if d['door_unlocked']]
        picked = [d['key_picked'] for d in details if d['key_picked']]
        self.assertIn('A', unlocked)
        self.assertIn('a', picked)

    def test_unsolvable_maze(self):
        # S # E
        # Key missing, door blocks
        grid = [
            ['S', 'A', 'E']
        ]
        solver = MazeSolver(grid, T=1)
        length, path, _ = solver.solve()
        self.assertEqual(length, -1)

    def test_generate_solvable(self):
        for t in [1, 2, 3, 4, 5, 6]:
            grid, length = generate_solvable_maze(N=15, T=t)
            self.assertGreater(length, 0, f"Failed for T={t}")
            solver = MazeSolver(grid, T=t)
            sol_len, path, details = solver.solve()
            self.assertEqual(sol_len, length)
            self.assertGreater(len(path), 0)

if __name__ == '__main__':
    unittest.main()
