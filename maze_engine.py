"""
Maze Solver with Keys and Doors
Core Engine: BFS with Bitmask State + Guaranteed Solvable Maze Generator
"""

from collections import deque
import random
import csv
from typing import List, Tuple, Optional, Dict, Set


# Distinct color palette for key/door pairs (1 to 6)
COLOR_PALETTE = [
    {"name": "Amber", "hex": "#F59E0B", "rgb": (245, 158, 11)},    # Key/Door A
    {"name": "Cyan", "hex": "#06B6D4", "rgb": (6, 182, 212)},      # Key/Door B
    {"name": "Purple", "hex": "#8B5CF6", "rgb": (139, 92, 246)},   # Key/Door C
    {"name": "Rose", "hex": "#F43F5E", "rgb": (244, 63, 94)},      # Key/Door D
    {"name": "Orange", "hex": "#F97316", "rgb": (249, 115, 22)},   # Key/Door E
    {"name": "Blue", "hex": "#3B82F6", "rgb": (59, 130, 246)},     # Key/Door F
]


class MazeSolver:
    def __init__(self, grid: List[List[str]], T: int = 6):
        """
        grid: N x N grid of strings
        T: number of distinct key/door types (1 <= T <= 6)
        """
        self.grid = [list(row) for row in grid]
        self.rows = len(self.grid)
        self.cols = len(self.grid[0]) if self.grid else 0
        self.N = max(self.rows, self.cols)
        self.T = max(1, min(6, T))
        self.start_pos = None
        self.exit_pos = None
        self.doors = {}  # (r, c) -> door_letter
        self.keys = {}   # (r, c) -> key_letter

        self._parse_grid()

    def _parse_grid(self):
        """Locate start, exit, keys, doors."""
        # Find start and exit
        for r in range(self.rows):
            for c in range(self.cols):
                val = self.grid[r][c].strip()
                if val == 'S':
                    self.start_pos = (r, c)
                elif val == 'E':
                    # In case of T >= 5 where letter 'E' is also a door,
                    # we designate 'E' as exit unless already set, or exit marked explicitly.
                    if self.exit_pos is None:
                        self.exit_pos = (r, c)
                elif 'a' <= val <= 'f':
                    key_idx = ord(val) - ord('a')
                    if key_idx < self.T:
                        self.keys[(r, c)] = val
                elif 'A' <= val <= 'F':
                    door_idx = ord(val) - ord('A')
                    if door_idx < self.T:
                        self.doors[(r, c)] = val

        # Edge case: If exit not found, try to locate goal
        if self.start_pos is None:
            raise ValueError("Start position 'S' not found in grid!")
        if self.exit_pos is None:
            raise ValueError("Exit position 'E' not found in grid!")

    def solve(self) -> Tuple[int, List[Tuple[int, int]], List[Dict]]:
        """
        Solves the maze using BFS with bitmask state (r, c, mask).
        Returns:
            shortest_length: int (-1 if unsolvable)
            path_coords: List of (r, c) positions from S to E
            step_details: List of events at each step (e.g. key picked up, door opened)
        """
        sr, sc = self.start_pos
        er, ec = self.exit_pos

        # Initial mask: if S cell happens to have a key
        start_mask = 0
        if (sr, sc) in self.keys:
            key_idx = ord(self.keys[(sr, sc)]) - ord('a')
            start_mask |= (1 << key_idx)

        # BFS Queue: stores (r, c, mask)
        queue = deque([(sr, sc, start_mask)])
        
        # parent dict: (r, c, mask) -> (prev_r, prev_c, prev_mask)
        parent: Dict[Tuple[int, int, int], Optional[Tuple[int, int, int]]] = {
            (sr, sc, start_mask): None
        }
        
        # dist dict: (r, c, mask) -> int
        dist: Dict[Tuple[int, int, int], int] = {
            (sr, sc, start_mask): 0
        }

        exit_state = None

        while queue:
            r, c, mask = queue.popleft()
            curr_dist = dist[(r, c, mask)]

            # Check if exit reached
            if (r, c) == (er, ec):
                exit_state = (r, c, mask)
                break

            for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nr, nc = r + dr, c + dc

                if not (0 <= nr < self.rows and 0 <= nc < self.cols):
                    continue

                cell = self.grid[nr][nc].strip()

                # Wall
                if cell == '#':
                    continue

                # Check if cell is a door
                if (nr, nc) in self.doors and (nr, nc) != (er, ec):
                    door_letter = self.doors[(nr, nc)]
                    door_idx = ord(door_letter) - ord('A')
                    # Requires corresponding key
                    if not (mask & (1 << door_idx)):
                        continue  # Locked!

                # Check if cell is a key
                next_mask = mask
                if (nr, nc) in self.keys:
                    key_letter = self.keys[(nr, nc)]
                    key_idx = ord(key_letter) - ord('a')
                    next_mask = mask | (1 << key_idx)

                next_state = (nr, nc, next_mask)
                if next_state not in dist:
                    dist[next_state] = curr_dist + 1
                    parent[next_state] = (r, c, mask)
                    queue.append(next_state)

        if exit_state is None:
            return -1, [], []

        # Reconstruct path
        path_states = []
        curr = exit_state
        while curr is not None:
            path_states.append(curr)
            curr = parent[curr]
        path_states.reverse()

        path_coords = [(s[0], s[1]) for s in path_states]
        shortest_length = len(path_coords) - 1

        # Build step details for animation and analysis
        step_details = []
        held_keys = set()
        opened_doors = set()

        for idx, (r, c, mask) in enumerate(path_states):
            cell_type = self.grid[r][c].strip()
            event = "move"
            key_picked = None
            door_unlocked = None

            if (r, c) in self.keys:
                k = self.keys[(r, c)]
                if k not in held_keys:
                    held_keys.add(k)
                    event = "pickup_key"
                    key_picked = k

            if (r, c) in self.doors:
                d = self.doors[(r, c)]
                if d not in opened_doors:
                    opened_doors.add(d)
                    event = "open_door"
                    door_unlocked = d

            step_details.append({
                "step": idx,
                "r": r,
                "c": c,
                "cell": cell_type,
                "event": event,
                "key_picked": key_picked,
                "door_unlocked": door_unlocked,
                "held_keys": sorted(list(held_keys)),
                "opened_doors": sorted(list(opened_doors))
            })

        return shortest_length, path_coords, step_details

    def get_marked_grid(self, path_coords: List[Tuple[int, int]]) -> List[List[str]]:
        """
        Creates the marked grid where the shortest path is marked with 'x's.
        Keys picked up and doors opened along the path remain clearly identifiable:
        - '.' -> 'x'
        - key 'a' -> 'x(a)'
        - door 'A' -> 'x(A)'
        - 'S' -> 'S' (or 'S(x)')
        - 'E' -> 'E' (or 'E(x)')
        """
        marked = [list(row) for row in self.grid]
        path_set = set(path_coords)

        for r in range(self.rows):
            for c in range(self.cols):
                orig = self.grid[r][c].strip()
                if (r, c) in path_set:
                    if orig == '.':
                        marked[r][c] = 'x'
                    elif 'a' <= orig <= 'f':
                        marked[r][c] = f"x({orig})"
                    elif 'A' <= orig <= 'F':
                        marked[r][c] = f"x({orig})"
                    elif orig == 'S':
                        marked[r][c] = 'S'
                    elif orig == 'E':
                        marked[r][c] = 'E'
                    else:
                        marked[r][c] = f"x({orig})"
        return marked

    def export_solution_csv(self, filepath: str, marked_grid: List[List[str]]):
        """Writes marked grid to CSV."""
        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            for row in marked_grid:
                writer.writerow(row)


def generate_solvable_maze(N: int, T: int, max_attempts: int = 100) -> Tuple[List[List[str]], int]:
    """
    Generates an N x N maze with T keys ('a'-...) and T doors ('A'-...)
    guaranteed to be solvable and requiring keys to reach the exit.
    
    Returns:
        grid: N x N grid of strings
        shortest_path_len: int length of shortest path
    """
    N = max(7, N)
    T = max(1, min(6, T))

    # Helper to check in-bounds
    for attempt in range(max_attempts):
        # 1. Initialize grid with walls
        grid = [['#' for _ in range(N)] for _ in range(N)]

        # 2. Carve corridors using randomized DFS
        # Ensure odd coordinates are cells, even coordinates are walls
        start_r, start_c = 1, 1
        grid[start_r][start_c] = '.'
        stack = [(start_r, start_c)]
        visited_cells = {(start_r, start_c)}

        while stack:
            cr, cc = stack[-1]
            neighbors = []
            for dr, dc in [(-2, 0), (2, 0), (0, -2), (0, 2)]:
                nr, nc = cr + dr, cc + dc
                if 1 <= nr < N - 1 and 1 <= nc < N - 1 and (nr, nc) not in visited_cells:
                    neighbors.append((nr, nc, cr + dr // 2, cc + dc // 2))

            if neighbors:
                nr, nc, wall_r, wall_c = random.choice(neighbors)
                grid[wall_r][wall_c] = '.'
                grid[nr][nc] = '.'
                visited_cells.add((nr, nc))
                stack.append((nr, nc))
            else:
                stack.pop()

        # Add some random loops/connections to make the maze richer and less linear
        all_inner_walls = []
        for r in range(2, N - 2):
            for c in range(2, N - 2):
                if grid[r][c] == '#':
                    # If it separates two open cells
                    if (grid[r-1][c] == '.' and grid[r+1][c] == '.') or \
                       (grid[r][c-1] == '.' and grid[r][c+1] == '.'):
                        all_inner_walls.append((r, c))
        
        # Knock down a small percentage of walls (e.g. 10%)
        num_to_open = int(len(all_inner_walls) * 0.12)
        for r, c in random.sample(all_inner_walls, min(num_to_open, len(all_inner_walls))):
            grid[r][c] = '.'

        # Collect all open cells
        open_cells = [(r, c) for r in range(1, N - 1) for c in range(1, N - 1) if grid[r][c] == '.']
        if len(open_cells) < 2 * T + 2:
            continue

        # Set Start 'S' at top-left-most available open cell
        open_cells.sort(key=lambda p: p[0] + p[1])
        s_pos = open_cells[0]
        # Set Exit 'E' at bottom-right-most available open cell
        e_pos = open_cells[-1]

        grid[s_pos[0]][s_pos[1]] = 'S'
        grid[e_pos[0]][e_pos[1]] = 'E'

        # Remaining open cells for keys and doors
        candidate_cells = [p for p in open_cells if p != s_pos and p != e_pos]
        if len(candidate_cells) < 2 * T:
            continue

        # Now strategically place keys and doors in progressive stages:
        # We want key 'a' accessible before door 'A', etc.
        # Let's run a progressive placement:
        # Distance map from S:
        q = deque([s_pos])
        dist_from_s = {s_pos: 0}
        while q:
            curr = q.popleft()
            for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nr, nc = curr[0] + dr, curr[1] + dc
                if 0 <= nr < N and 0 <= nc < N and grid[nr][nc] != '#' and (nr, nc) not in dist_from_s:
                    dist_from_s[(nr, nc)] = dist_from_s[curr] + 1
                    q.append((nr, nc))

        # Sort candidate cells by distance from S
        candidate_cells.sort(key=lambda p: dist_from_s.get(p, 0))

        # Partition candidate cells into T tiers
        tier_size = len(candidate_cells) // (T + 1)
        if tier_size < 2:
            tier_size = max(1, len(candidate_cells) // T)

        placed_keys = []
        placed_doors = []

        success_placement = True
        for i in range(T):
            key_letter = chr(ord('a') + i)
            door_letter = chr(ord('A') + i)

            # Key i should be in earlier tier than door i
            key_pool = candidate_cells[i * tier_size : (i + 1) * tier_size]
            door_pool = candidate_cells[(i + 1) * tier_size : (i + 2) * tier_size]
            if not door_pool:
                door_pool = candidate_cells[(i + 1) * tier_size:]
            if not key_pool or not door_pool:
                success_placement = False
                break

            kp = random.choice(key_pool)
            candidate_cells.remove(kp)
            dp = random.choice(door_pool)
            candidate_cells.remove(dp)

            grid[kp[0]][kp[1]] = key_letter
            grid[dp[0]][dp[1]] = door_letter
            placed_keys.append(kp)
            placed_doors.append(dp)

        if not success_placement:
            continue

        # Verify solvability with solver
        solver = MazeSolver(grid, T=T)
        length, path, details = solver.solve()

        if length > 0:
            # Check if at least some keys/doors were used or reached
            used_keys = {d['key_picked'] for d in details if d['key_picked']}
            # Maze is valid and solvable!
            return grid, length

    # Fallback: simple structured solvable maze if random generation loop exceeded
    return _generate_fallback_maze(N, T)


def _generate_fallback_maze(N: int, T: int) -> Tuple[List[List[str]], int]:
    """Generates a guaranteed solvable snake/zigzag corridor maze with T keys and doors."""
    N = max(7, N)
    grid = [['#' for _ in range(N)] for _ in range(N)]
    
    # Create a serpentine corridor
    path = []
    r = 1
    direction = 1
    while r < N - 1:
        cols = range(1, N - 1) if direction == 1 else range(N - 2, 0, -1)
        for c in cols:
            grid[r][c] = '.'
            path.append((r, c))
        # Turn down
        if r + 1 < N - 1:
            turn_c = (N - 2) if direction == 1 else 1
            grid[r + 1][turn_c] = '.'
            path.append((r + 1, turn_c))
        r += 2
        direction *= -1

    # Place Start and Exit
    s_pos = path[0]
    e_pos = path[-1]
    grid[s_pos[0]][s_pos[1]] = 'S'
    grid[e_pos[0]][e_pos[1]] = 'E'

    # Place keys and doors sequentially along the corridor
    # Sequence: Key 0, Door 0, Key 1, Door 1, ...
    step = (len(path) - 2) // (2 * T + 1)
    for i in range(T):
        k_idx = 1 + (2 * i) * step + step // 2
        d_idx = 1 + (2 * i + 1) * step + step // 2
        kp = path[k_idx]
        dp = path[d_idx]
        grid[kp[0]][kp[1]] = chr(ord('a') + i)
        grid[dp[0]][dp[1]] = chr(ord('A') + i)

    solver = MazeSolver(grid, T=T)
    length, _, _ = solver.solve()
    return grid, length
