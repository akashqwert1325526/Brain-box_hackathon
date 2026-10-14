import java.io.*;
import java.util.*;

/**
 * Problem 3: Budget Traveller with Coupons
 *
 * Finds the minimum cost to travel from city 1 to city N with at most K stops
 * (i.e. at most K + 1 flights) and up to C discount coupons (50% off, rounded down).
 */
public class BudgetTraveller {

    // Represents a one-way flight
    static class Flight {
        int id;
        int u;
        int v;
        long price;

        Flight(int id, int u, int v, long price) {
            this.id = id;
            this.u = u;
            this.v = v;
            this.price = price;
        }
    }

    // State for Dijkstra's algorithm
    static class State implements Comparable<State> {
        long cost;
        int city;
        int flights; // number of flights used so far (<= K + 1)
        int coupons; // number of coupons used so far (<= C)

        State(long cost, int city, int flights, int coupons) {
            this.cost = cost;
            this.city = city;
            this.flights = flights;
            this.coupons = coupons;
        }

        @Override
        public int compareTo(State other) {
            return Long.compare(this.cost, other.cost);
        }
    }

    // Node for reconstructing the path
    static class ParentNode {
        int prevCity;
        int prevFlights;
        int prevCoupons;
        Flight flight;
        boolean couponUsed;

        ParentNode(int prevCity, int prevFlights, int prevCoupons, Flight flight, boolean couponUsed) {
            this.prevCity = prevCity;
            this.prevFlights = prevFlights;
            this.prevCoupons = prevCoupons;
            this.flight = flight;
            this.couponUsed = couponUsed;
        }
    }

    public static class Result {
        public long minCost;
        public List<FlightStep> path; // list of steps taken

        public Result(long minCost, List<FlightStep> path) {
            this.minCost = minCost;
            this.path = path;
        }
    }

    public static class FlightStep {
        public Flight flight;
        public boolean couponUsed;
        public long paidCost;

        public FlightStep(Flight flight, boolean couponUsed, long paidCost) {
            this.flight = flight;
            this.couponUsed = couponUsed;
            this.paidCost = paidCost;
        }
    }

    /**
     * Solves the Budget Traveller problem using Dijkstra on (city, flights, coupons).
     *
     * @param N       Total number of cities (1 to N)
     * @param flights List of all flights in graph
     * @param K       Maximum allowed stops (meaning max K + 1 flights)
     * @param C       Number of discount coupons
     * @return Result containing minCost (-1 if impossible) and the path taken
     */
    public static Result solve(int N, List<Flight> flights, int K, int C) {
        if (N <= 1) {
            return new Result(0, new ArrayList<>());
        }

        int maxFlights = K + 1;
        int maxCoupons = Math.min(C, maxFlights);

        // Build adjacency list: city -> list of flights
        List<List<Flight>> adj = new ArrayList<>();
        for (int i = 0; i <= N; i++) {
            adj.add(new ArrayList<>());
        }
        for (Flight f : flights) {
            if (f.u >= 1 && f.u <= N) {
                adj.get(f.u).add(f);
            }
        }

        // dist[city][flights][coupons] = min cost
        long[][][] dist = new long[N + 1][maxFlights + 1][maxCoupons + 1];
        ParentNode[][][] parent = new ParentNode[N + 1][maxFlights + 1][maxCoupons + 1];

        for (int i = 0; i <= N; i++) {
            for (int f = 0; f <= maxFlights; f++) {
                Arrays.fill(dist[i][f], Long.MAX_VALUE);
            }
        }

        PriorityQueue<State> pq = new PriorityQueue<>();

        // Start at city 1 with 0 flights and 0 coupons used
        dist[1][0][0] = 0;
        pq.add(new State(0, 1, 0, 0));

        State targetState = null;

        while (!pq.isEmpty()) {
            State curr = pq.poll();

            // If reached destination city N, this is the optimal shortest path
            if (curr.city == N) {
                targetState = curr;
                break;
            }

            if (curr.cost > dist[curr.city][curr.flights][curr.coupons]) {
                continue;
            }

            // If we have already used the maximum number of flights (K + 1), cannot fly further
            if (curr.flights >= maxFlights) {
                continue;
            }

            for (Flight edge : adj.get(curr.city)) {
                int nextCity = edge.v;
                int nextFlights = curr.flights + 1;

                // Option A: Fly without coupon
                long costWithout = curr.cost + edge.price;
                if (costWithout < dist[nextCity][nextFlights][curr.coupons]) {
                    dist[nextCity][nextFlights][curr.coupons] = costWithout;
                    parent[nextCity][nextFlights][curr.coupons] =
                            new ParentNode(curr.city, curr.flights, curr.coupons, edge, false);
                    pq.add(new State(costWithout, nextCity, nextFlights, curr.coupons));
                }

                // Option B: Fly with coupon (if we still have coupons remaining)
                if (curr.coupons < maxCoupons) {
                    int nextCoupons = curr.coupons + 1;
                    long costWith = curr.cost + (edge.price / 2);
                    if (costWith < dist[nextCity][nextFlights][nextCoupons]) {
                        dist[nextCity][nextFlights][nextCoupons] = costWith;
                        parent[nextCity][nextFlights][nextCoupons] =
                                new ParentNode(curr.city, curr.flights, curr.coupons, edge, true);
                        pq.add(new State(costWith, nextCity, nextFlights, nextCoupons));
                    }
                }
            }
        }

        if (targetState == null) {
            return new Result(-1, new ArrayList<>());
        }

        // Reconstruct path
        List<FlightStep> path = new ArrayList<>();
        int currCity = targetState.city;
        int currF = targetState.flights;
        int currC = targetState.coupons;

        while (currCity != 1 || currF != 0) {
            ParentNode p = parent[currCity][currF][currC];
            if (p == null) break;
            long paid = p.couponUsed ? (p.flight.price / 2) : p.flight.price;
            path.add(new FlightStep(p.flight, p.couponUsed, paid));
            currCity = p.prevCity;
            currF = p.prevFlights;
            currC = p.prevCoupons;
        }

        Collections.reverse(path);
        return new Result(targetState.cost, path);
    }

    /**
     * Export the graph to CSV with the optimal path marked with 'x's and coupons indicated.
     */
    public static void exportGraphToCSV(String filepath, List<Flight> allFlights, List<FlightStep> path) throws IOException {
        Set<Integer> pathFlightIds = new HashSet<>();
        Map<Integer, Boolean> couponMap = new HashMap<>();

        for (FlightStep step : path) {
            pathFlightIds.add(step.flight.id);
            couponMap.put(step.flight.id, step.couponUsed);
        }

        try (PrintWriter writer = new PrintWriter(new FileWriter(filepath))) {
            writer.println("flight_id,u,v,price,on_path,coupon_used,actual_cost");
            for (Flight f : allFlights) {
                boolean onPath = pathFlightIds.contains(f.id);
                String marked = onPath ? "x" : "";
                String couponUsed = "";
                String actualCost = "";

                if (onPath) {
                    boolean used = couponMap.getOrDefault(f.id, false);
                    couponUsed = used ? "yes" : "no";
                    actualCost = String.valueOf(used ? (f.price / 2) : f.price);
                }

                writer.println(f.id + "," + f.u + "," + f.v + "," + f.price + "," + marked + "," + couponUsed + "," + actualCost);
            }
        }
    }

    /**
     * Read graph from a CSV file.
     * Supports formats:
     * u,v,price
     * or flight_id,u,v,price
     */
    public static List<Flight> readGraphFromCSV(String filepath) throws IOException {
        List<Flight> flights = new ArrayList<>();
        try (BufferedReader br = new BufferedReader(new FileReader(filepath))) {
            String line;
            int autoId = 1;
            while ((line = br.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("#") || line.toLowerCase().startsWith("u,") || line.toLowerCase().startsWith("flight")) {
                    continue; // skip headers
                }
                String[] tokens = line.split(",");
                if (tokens.length >= 3) {
                    // Check if first token is an ID or u
                    int u, v;
                    long p;
                    if (tokens.length >= 4) {
                        // id, u, v, price
                        u = Integer.parseInt(tokens[1].trim());
                        v = Integer.parseInt(tokens[2].trim());
                        p = Long.parseLong(tokens[3].trim());
                    } else {
                        // u, v, price
                        u = Integer.parseInt(tokens[0].trim());
                        v = Integer.parseInt(tokens[1].trim());
                        p = Long.parseLong(tokens[2].trim());
                    }
                    flights.add(new Flight(autoId++, u, v, p));
                }
            }
        }
        return flights;
    }

    /**
     * Generates a valid random graph with guaranteed path from 1 to N within K stops.
     */
    public static List<Flight> generateValidGraph(int N, int M, int K) {
        List<Flight> flights = new ArrayList<>();
        Random rng = new Random();
        int flightId = 1;

        // 1. First, create a guaranteed valid backbone path of length <= K + 1
        int pathLen = Math.min(N - 1, Math.min(K + 1, Math.max(1, K + 1)));
        List<Integer> intermediate = new ArrayList<>();
        for (int i = 2; i < N; i++) {
            intermediate.add(i);
        }
        Collections.shuffle(intermediate, rng);

        List<Integer> backbone = new ArrayList<>();
        backbone.add(1);
        int numInter = Math.min(pathLen - 1, intermediate.size());
        for (int i = 0; i < numInter; i++) {
            backbone.add(intermediate.get(i));
        }
        backbone.add(N);

        Set<String> existingEdges = new HashSet<>();
        for (int i = 0; i < backbone.size() - 1; i++) {
            int u = backbone.get(i);
            int v = backbone.get(i + 1);
            long price = 100 + rng.nextInt(900); // price between 100 and 1000
            flights.add(new Flight(flightId++, u, v, price));
            existingEdges.add(u + "->" + v);
        }

        // 2. Add remaining random edges to reach M edges
        int targetM = Math.max(M, flights.size() + 5);
        int attempts = 0;
        while (flights.size() < targetM && attempts < 1000) {
            attempts++;
            int u = 1 + rng.nextInt(N);
            int v = 1 + rng.nextInt(N);
            if (u != v && !existingEdges.contains(u + "->" + v)) {
                existingEdges.add(u + "->" + v);
                long price = 50 + rng.nextInt(950);
                flights.add(new Flight(flightId++, u, v, price));
            }
        }

        return flights;
    }

    // ==========================================
    // Interactive / Main Execution
    // ==========================================
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);

        System.out.println("============================================================");
        System.out.println("    PROBLEM 3: BUDGET TRAVELLER WITH COUPONS (JAVA)         ");
        System.out.println("============================================================");

        System.out.println("Select Input Option:");
        System.out.println("  [1] Option 1: Standard Input (N M, K C, followed by M lines: u v p)");
        System.out.println("  [2] Option 2: CSV File (K C, then path to CSV file)");
        System.out.println("  [3] Option 3: Generate a Valid Graph (with user specified K and C)");
        System.out.print("Enter choice (1, 2, or 3): ");

        int option = 1;
        if (scanner.hasNextInt()) {
            option = scanner.nextInt();
        }

        int N = 0;
        int K = 0;
        int C = 0;
        List<Flight> flights = new ArrayList<>();

        try {
            if (option == 1) {
                // Option 1:
                // First line: N M
                // Next line: K C
                // Next M lines: u v p
                System.out.println("\nEnter N (number of cities) and M (number of flights):");
                N = scanner.nextInt();
                int M = scanner.nextInt();

                System.out.println("Enter K (max stops) and C (discount coupons):");
                K = scanner.nextInt();
                C = scanner.nextInt();

                System.out.println("Enter " + M + " lines of flights (u v p):");
                for (int i = 1; i <= M; i++) {
                    int u = scanner.nextInt();
                    int v = scanner.nextInt();
                    long p = scanner.nextLong();
                    flights.add(new Flight(i, u, v, p));
                }

            } else if (option == 2) {
                // Option 2:
                // First line: K C
                // Read graph from CSV file
                System.out.println("\nEnter K (max stops) and C (discount coupons):");
                K = scanner.nextInt();
                C = scanner.nextInt();
                scanner.nextLine(); // consume newline

                System.out.print("Enter CSV file path (e.g. flights.csv): ");
                String csvPath = scanner.nextLine().trim();
                flights = readGraphFromCSV(csvPath);

                // Auto-detect N as maximum city id
                for (Flight f : flights) {
                    N = Math.max(N, Math.max(f.u, f.v));
                }
                System.out.println("Loaded " + flights.size() + " flights. Cities: 1 to " + N);

            } else if (option == 3) {
                // Option 3:
                // Generate a valid graph with user specified K and C
                System.out.println("\nEnter K (max stops) and C (discount coupons):");
                K = scanner.nextInt();
                C = scanner.nextInt();

                System.out.print("Enter number of cities N (e.g. 6): ");
                N = scanner.nextInt();
                System.out.print("Enter number of flights M (e.g. 10): ");
                int M = scanner.nextInt();

                flights = generateValidGraph(N, M, K);
                System.out.println("Generated valid graph with " + N + " cities and " + flights.size() + " flights.");

                // Save generated graph to CSV
                String genFile = "generated_flights.csv";
                exportGraphToCSV(genFile, flights, new ArrayList<>());
                System.out.println("Saved generated graph to: " + genFile);
            }

            // Solve
            Result res = solve(N, flights, K, C);

            // Output 1: minimum cost or -1
            System.out.println("\n" + "=".repeat(40));
            System.out.println("OUTPUT 1: " + res.minCost);
            System.out.println("=".repeat(40));

            // Output 2: CSV file of the graph with the path marked with 'x's
            String outputCSV = "budget_traveller_solution.csv";
            exportGraphToCSV(outputCSV, flights, res.path);
            System.out.println("OUTPUT 2: Saved marked path CSV to " + outputCSV);

            // Detailed itinerary preview
            if (res.minCost != -1) {
                System.out.println("\n--- Optimal Itinerary ---");
                System.out.println("Stops made: " + (res.path.size() - 1) + " (Max allowed: " + K + ")");
                int couponsUsed = 0;
                for (int i = 0; i < res.path.size(); i++) {
                    FlightStep step = res.path.get(i);
                    if (step.couponUsed) couponsUsed++;
                    System.out.printf("  Step %d: City %d -> City %d | Base Price: %d | Coupon: %s | Paid: %d%n",
                            i + 1, step.flight.u, step.flight.v, step.flight.price,
                            step.couponUsed ? "YES (50% OFF)" : "NO", step.paidCost);
                }
                System.out.println("Total Coupons Used: " + couponsUsed + " / " + C);
                System.out.println("Total Minimum Cost: " + res.minCost);
                System.out.println("-------------------------\n");
            } else {
                System.out.println("No flight route from City 1 to City " + N + " within " + K + " stops.");
            }

        } catch (Exception e) {
            System.err.println("Error: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
