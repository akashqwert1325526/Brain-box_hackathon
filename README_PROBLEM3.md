# Problem 3: Budget Traveller with Coupons (Java)

## 📌 Problem Overview
You need to travel from City 1 to City $N$ using one-way flights under two constraints:
1. **At most $K$ stops** (intermediate cities) $\implies$ at most $K + 1$ flights.
2. **At most $C$ discount coupons**: Each coupon halves a flight's ticket price ($\lfloor p / 2 \rfloor$). At most one coupon can be used per flight.

Find the **minimum total cost** to reach City $N$, or `-1` if impossible.

---

## 🧠 Algorithm: Modified Dijkstra on Multi-Dimensional State
- **State**: `(city, flights_used, coupons_used)`
  - `city` $\in [1, N]$
  - `flights_used` $\in [0, K + 1]$
  - `coupons_used` $\in [0, \min(C, K + 1)]$
- **Dijkstra PriorityQueue**:
  - Pops lowest accumulated cost state.
  - Explores two transitions for each outgoing edge $(u, v, p)$:
    1. **Without Coupon**: $(v, \text{flights} + 1, \text{coupons})$ with cost $+ p$.
    2. **With Coupon** (if $\text{coupons} < C$): $(v, \text{flights} + 1, \text{coupons} + 1)$ with cost $+ \lfloor p / 2 \rfloor$.
- **Time Complexity**: $O((K \cdot C \cdot M) \log(K \cdot C \cdot N))$ — blazingly fast and optimal.

---

## 🚀 How to Run

### Compile
```bash
javac BudgetTraveller.java
```

### Run
```bash
java BudgetTraveller
```

### Supported Input Options:
- **Option 1: Standard Input**
  ```text
  N M
  K C
  u v p  (M lines)
  ```
- **Option 2: CSV File**
  ```text
  K C
  path/to/flights.csv
  ```
- **Option 3: Solvable Random Graph Generator**
  - Enter $K, C, N, M$ to automatically generate a solvable flight network.

### Outputs:
- **Output 1**: Minimum total cost (single integer) or `-1`.
- **Output 2**: `budget_traveller_solution.csv` containing all graph edges with path marked `'x'`, whether a coupon was applied (`yes`/`no`), and actual paid cost.

---

## 🎨 Interactive Graph Visualizer (Web & Desktop)

### 1. Modern Web Visualizer
Open `index.html` in any browser or launch:
```bash
python traveller_solver.py --web
# or on Windows
start index.html
```

#### Visual Features:
- **Graph Topology**: Cities as circular nodes ($1 \dots N$) with directed, weighted flight edges.
- **Node Color Coding**:
  - **Start City (1)**: Vibrant **Green** with glowing pulse ring and `START • CITY 1` badge.
  - **Destination City ($N$)**: Vibrant **Red** with glowing pulse ring and `DEST • CITY N` badge.
  - **Intermediate Stops**: Marked in **Orange** with `STOP` badge along the optimal route.
- **Chosen Path Highlighting**: Optimal flight sequence highlighted in glowing cyan.
- **Coupon Applied Effect**:
  - Flight edge turns **Radiant Gold** (`#FFD700`) with glowing aura and golden ticket badge.
  - Price dynamically displays original price crossed out $\to$ discounted price: `~~$618~~ ➔ $309` (`50% OFF`).
- **Animated Journey**:
  - Airplane avatar (`✈️`) flies smoothly along each flight hop.
  - **Real-Time Running Cost HUD**: Smooth odometer counter updates as the traveller progresses.
  - **Live Stops & Coupons Counter**: Tracks stops used ($\le K$) and coupons applied ($\le C$).
  - **Interactive Playback**: Play, Pause, Step Forward/Back, Reset, Timeline Scrubber, Speed controls.
  - **Interactive Graph Canvas**: Drag & drop any city node to customize layout, plus auto-layout modes (Circle, Layered Flow).

### 2. Native Desktop GUI (Tkinter)
Launch the standalone native Python desktop visualizer:
```bash
python traveller_gui.py
```

