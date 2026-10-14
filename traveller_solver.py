import sys
import os
import csv
import heapq
import random
import argparse
import webbrowser
from typing import List, Tuple, Dict, Optional, NamedTuple

if sys.platform == 'win32' and sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass


class Flight(NamedTuple):
    id: int
    u: int
    v: int
    price: int


class FlightStep(NamedTuple):
    flight: Flight
    coupon_used: bool
    paid_cost: int


class SolverResult(NamedTuple):
    min_cost: int
    path: List[FlightStep]


def solve_budget_traveller(N: int, flights: List[Flight], K: int, C: int) -> SolverResult:
    """
    Modified Dijkstra on multi-dimensional state (cost, city, flights_used, coupons_used).
    """
    if N <= 1:
        return SolverResult(0, [])

    max_flights = K + 1
    max_coupons = min(C, max_flights)

    # Build adjacency list: city -> list of flights
    adj = {i: [] for i in range(1, N + 1)}
    for f in flights:
        if 1 <= f.u <= N and 1 <= f.v <= N:
            adj[f.u].append(f)

    # dist[city][flights][coupons] = min cost
    # parent[city][flights][coupons] = (prevCity, prevFlights, prevCoupons, flight, couponUsed)
    dist = {}
    parent = {}

    pq = []
    # (cost, city, flights_used, coupons_used)
    heapq.heappush(pq, (0, 1, 0, 0))
    dist[(1, 0, 0)] = 0

    target_state = None

    while pq:
        curr_cost, curr_city, curr_flights, curr_coupons = heapq.heappop(pq)

        if curr_city == N:
            target_state = (curr_cost, curr_city, curr_flights, curr_coupons)
            break

        if curr_cost > dist.get((curr_city, curr_flights, curr_coupons), float('inf')):
            continue

        if curr_flights >= max_flights:
            continue

        for edge in adj.get(curr_city, []):
            next_city = edge.v
            next_flights = curr_flights + 1

            # Option A: Without coupon
            cost_without = curr_cost + edge.price
            state_a = (next_city, next_flights, curr_coupons)
            if cost_without < dist.get(state_a, float('inf')):
                dist[state_a] = cost_without
                parent[state_a] = (curr_city, curr_flights, curr_coupons, edge, False)
                heapq.heappush(pq, (cost_without, next_city, next_flights, curr_coupons))

            # Option B: With coupon (halves price, rounded down)
            if curr_coupons < max_coupons:
                discounted = edge.price // 2
                cost_with = curr_cost + discounted
                state_b = (next_city, next_flights, curr_coupons + 1)
                if cost_with < dist.get(state_b, float('inf')):
                    dist[state_b] = cost_with
                    parent[state_b] = (curr_city, curr_flights, curr_coupons, edge, True)
                    heapq.heappush(pq, (cost_with, next_city, next_flights, curr_coupons + 1))

    if not target_state:
        return SolverResult(-1, [])

    # Reconstruct path
    path = []
    curr_cost, curr_city, curr_flights, curr_coupons = target_state

    while curr_city != 1 or curr_flights != 0:
        p_info = parent.get((curr_city, curr_flights, curr_coupons))
        if not p_info:
            break
        prev_city, prev_flights, prev_coupons, edge, coupon_used = p_info
        paid = edge.price // 2 if coupon_used else edge.price
        path.append(FlightStep(edge, coupon_used, paid))
        curr_city = prev_city
        curr_flights = prev_flights
        curr_coupons = prev_coupons

    path.reverse()
    return SolverResult(target_state[0], path)


def export_solution_csv(filepath: str, all_flights: List[Flight], path: List[FlightStep]) -> None:
    """
    Exports budget_traveller_solution.csv with columns:
    flight_id,u,v,price,on_path,coupon_used,actual_cost
    """
    path_ids = {s.flight.id for s in path}
    coupon_map = {s.flight.id: s.coupon_used for s in path}

    with open(filepath, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(["flight_id", "u", "v", "price", "on_path", "coupon_used", "actual_cost"])
        for fl in all_flights:
            on_path = fl.id in path_ids
            marked = 'x' if on_path else ''
            used = coupon_map.get(fl.id, False) if on_path else ''
            coupon_str = ('yes' if used else 'no') if on_path else ''
            actual_cost = str(fl.price // 2 if used else fl.price) if on_path else ''
            writer.writerow([fl.id, fl.u, fl.v, fl.price, marked, coupon_str, actual_cost])


def read_flights_from_csv(filepath: str) -> Tuple[int, List[Flight]]:
    """
    Reads flights from CSV. Supports headers:
    u,v,price or flight_id,u,v,price or budget_traveller_solution.csv
    Returns (max_city, flights).
    """
    flights = []
    max_city = 2
    auto_id = 1

    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or line.lower().startswith('u,') or line.lower().startswith('flight'):
                continue
            parts = [p.strip() for p in line.split(',')]
            if len(parts) >= 3:
                try:
                    if len(parts) >= 4 and parts[0].isdigit() and parts[1].isdigit() and parts[2].isdigit():
                        u = int(parts[1])
                        v = int(parts[2])
                        price = int(parts[3])
                    else:
                        u = int(parts[0])
                        v = int(parts[1])
                        price = int(parts[2])
                    flights.append(Flight(auto_id, u, v, price))
                    auto_id += 1
                    max_city = max(max_city, u, v)
                except ValueError:
                    continue
    return max_city, flights


def generate_valid_graph(N: int, M: int, K: int) -> List[Flight]:
    """
    Generates a solvable random flight graph with N cities and M flights
    ensuring a valid path from 1 to N with <= K stops.
    """
    flights = []
    next_id = 1
    actual_stops = min(K, max(0, N - 2))

    available = list(range(2, N))
    random.shuffle(available)
    chosen_stops = available[:actual_stops]

    backbone = [1] + chosen_stops + [N]
    for i in range(len(backbone) - 1):
        u = backbone[i]
        v = backbone[i + 1]
        price = random.randint(100, 700)
        flights.append(Flight(next_id, u, v, price))
        next_id += 1

    existing = {(f.u, f.v) for f in flights}
    attempts = 0
    while len(flights) < M and attempts < 200:
        attempts += 1
        u = random.randint(1, N)
        v = random.randint(1, N)
        if u != v and (u, v) not in existing:
            existing.add((u, v))
            price = random.randint(80, 950)
            flights.append(Flight(next_id, u, v, price))
            next_id += 1

    return flights


def main():
    parser = argparse.ArgumentParser(description="Budget Traveller with Coupons Solver & Visualizer")
    parser.add_argument("--N", type=int, help="Total cities (1 to N)")
    parser.add_argument("--K", type=int, default=2, help="Max stops allowed")
    parser.add_argument("--C", type=int, default=1, help="Max discount coupons")
    parser.add_argument("--input", type=str, help="Path to flights CSV file")
    parser.add_argument("--generate", type=int, help="Generate solvable graph with N cities")
    parser.add_argument("--flights-count", type=int, default=10, help="Number of flights to generate")
    parser.add_argument("--output", type=str, default="budget_traveller_solution.csv", help="Output solution CSV path")
    parser.add_argument("--web", action="store_true", help="Launch modern web visualizer in browser")
    parser.add_argument("--gui", action="store_true", help="Launch native Tkinter desktop visualizer")

    args = parser.parse_args()

    # Web launch flag
    if args.web:
        html_path = os.path.abspath("index.html")
        print(f"Opening modern Web Visualizer: {html_path}")
        webbrowser.open(f"file:///{html_path}")
        return

    # Native GUI launch flag
    if args.gui:
        try:
            import traveller_gui
            traveller_gui.launch_gui()
            return
        except ImportError as e:
            print(f"Tkinter GUI error: {e}. Opening web visualizer instead.")
            webbrowser.open(f"file:///{os.path.abspath('index.html')}")
            return

    # If flags provided
    if args.input:
        N, flights = read_flights_from_csv(args.input)
        if args.N:
            N = args.N
        K = args.K
        C = args.C
    elif args.generate:
        N = args.generate
        K = args.K
        C = args.C
        flights = generate_valid_graph(N, args.flights_count, K)
    else:
        # Interactive CLI mode
        print("=" * 60)
        print("✈️ Problem 3: Budget Traveller with Coupons")
        print("=" * 60)
        print("Select Input Mode:")
        print("  1. Load Flights from CSV")
        print("  2. Generate Solvable Random Flight Graph")
        print("  3. Standard Manual Input (N M, K C, u v price)")
        print("  4. Launch Interactive Web Visualizer")
        choice = input("Enter option (1/2/3/4) [default: 1]: ").strip()

        if choice == '4':
            webbrowser.open(f"file:///{os.path.abspath('index.html')}")
            return
        elif choice == '2':
            N = int(input("Total cities N [e.g. 5]: ").strip() or "5")
            K = int(input("Max intermediate stops K [e.g. 2]: ").strip() or "2")
            C = int(input("Coupons C [e.g. 1]: ").strip() or "1")
            M = int(input("Total flights M [e.g. 9]: ").strip() or "9")
            flights = generate_valid_graph(N, M, K)
        elif choice == '3':
            nm = input("Enter N M: ").strip().split()
            N, M = int(nm[0]), int(nm[1])
            kc = input("Enter K C: ").strip().split()
            K, C = int(kc[0]), int(kc[1])
            flights = []
            print(f"Enter {M} lines of 'u v price':")
            for i in range(M):
                line = input().strip().split()
                flights.append(Flight(i + 1, int(line[0]), int(line[1]), int(line[2])))
        else:
            filepath = input("Enter CSV path [default: sample_flights.csv]: ").strip() or "sample_flights.csv"
            K = int(input("Max intermediate stops K [default: 2]: ").strip() or "2")
            C = int(input("Coupons C [default: 1]: ").strip() or "1")
            N, flights = read_flights_from_csv(filepath)

    result = solve_budget_traveller(N, flights, K, C)

    print("\n" + "=" * 60)
    print("🎯 RESULTS")
    print("=" * 60)
    print(f"Output 1 (Minimum Cost): {result.min_cost}")

    if result.min_cost != -1:
        print(f"Total Flights: {len(result.path)} (Stops: {len(result.path) - 1} / Max: {K})")
        print("Journey Path Breakdown:")
        for idx, step in enumerate(result.path, 1):
            coupon_tag = " [🎟️ COUPON APPLIED - 50% OFF]" if step.coupon_used else ""
            print(f"  Step {idx}: City {step.flight.u} ➔ City {step.flight.v} | Paid: ${step.paid_cost}{coupon_tag}")

        export_solution_csv(args.output, flights, result.path)
        print(f"\nOutput 2: Solution exported to '{args.output}'")
    else:
        print(f"City {N} unreachable from City 1 within {K} stops.")


if __name__ == '__main__':
    main()
