import java.io.File;
import java.util.ArrayList;
import java.util.List;

public class TestBudgetTraveller {

    public static void main(String[] args) {
        System.out.println("Running BudgetTraveller Tests...");
        int passed = 0;
        int failed = 0;

        // Test 1: Standard example
        try {
            int N = 4;
            int K = 1; // max 1 stop (2 flights)
            int C = 1; // 1 coupon
            List<BudgetTraveller.Flight> flights = new ArrayList<>();
            flights.add(new BudgetTraveller.Flight(1, 1, 2, 100));
            flights.add(new BudgetTraveller.Flight(2, 2, 4, 500));
            flights.add(new BudgetTraveller.Flight(3, 1, 3, 200));
            flights.add(new BudgetTraveller.Flight(4, 3, 4, 200));
            flights.add(new BudgetTraveller.Flight(5, 1, 4, 1000));

            BudgetTraveller.Result res = BudgetTraveller.solve(N, flights, K, C);
            // 1 -> 3 (200) + 3 -> 4 (coupon on 200 => 100) = 300
            if (res.minCost == 300) {
                System.out.println("[PASS] Test 1: Optimal cost with 1 stop and 1 coupon = 300");
                passed++;
            } else {
                System.err.println("[FAIL] Test 1: Expected 300, got " + res.minCost);
                failed++;
            }
        } catch (Exception e) {
            System.err.println("[FAIL] Test 1 Exception: " + e.getMessage());
            failed++;
        }

        // Test 2: Impossible due to K stops constraint
        try {
            int N = 4;
            int K = 0; // 0 stops (only direct flight)
            int C = 0;
            List<BudgetTraveller.Flight> flights = new ArrayList<>();
            flights.add(new BudgetTraveller.Flight(1, 1, 2, 100));
            flights.add(new BudgetTraveller.Flight(2, 2, 3, 100));
            flights.add(new BudgetTraveller.Flight(3, 3, 4, 100));

            BudgetTraveller.Result res = BudgetTraveller.solve(N, flights, K, C);
            if (res.minCost == -1) {
                System.out.println("[PASS] Test 2: Unreachable within K=0 stops returned -1");
                passed++;
            } else {
                System.err.println("[FAIL] Test 2: Expected -1, got " + res.minCost);
                failed++;
            }
        } catch (Exception e) {
            System.err.println("[FAIL] Test 2 Exception: " + e.getMessage());
            failed++;
        }

        // Test 3: Coupon halving rounded down (e.g. 99 / 2 = 49)
        try {
            int N = 2;
            int K = 0;
            int C = 1;
            List<BudgetTraveller.Flight> flights = new ArrayList<>();
            flights.add(new BudgetTraveller.Flight(1, 1, 2, 99));

            BudgetTraveller.Result res = BudgetTraveller.solve(N, flights, K, C);
            if (res.minCost == 49) {
                System.out.println("[PASS] Test 3: 99 halved rounded down = 49");
                passed++;
            } else {
                System.err.println("[FAIL] Test 3: Expected 49, got " + res.minCost);
                failed++;
            }
        } catch (Exception e) {
            System.err.println("[FAIL] Test 3 Exception: " + e.getMessage());
            failed++;
        }

        // Test 4: CSV export and re-import
        try {
            int N = 4;
            int K = 2;
            int C = 2;
            List<BudgetTraveller.Flight> flights = new ArrayList<>();
            flights.add(new BudgetTraveller.Flight(1, 1, 2, 150));
            flights.add(new BudgetTraveller.Flight(2, 2, 3, 250));
            flights.add(new BudgetTraveller.Flight(3, 3, 4, 350));
            flights.add(new BudgetTraveller.Flight(4, 1, 4, 900));

            BudgetTraveller.Result res = BudgetTraveller.solve(N, flights, K, C);
            String csvFile = "test_solution_export.csv";
            BudgetTraveller.exportGraphToCSV(csvFile, flights, res.path);

            File f = new File(csvFile);
            if (f.exists() && f.length() > 0) {
                System.out.println("[PASS] Test 4: Solution exported to CSV successfully");
                passed++;
            } else {
                System.err.println("[FAIL] Test 4: Exported CSV file missing or empty");
                failed++;
            }
        } catch (Exception e) {
            System.err.println("[FAIL] Test 4 Exception: " + e.getMessage());
            failed++;
        }

        // Test 5: Graph Generation
        try {
            int N = 8;
            int K = 3;
            int C = 2;
            List<BudgetTraveller.Flight> genFlights = BudgetTraveller.generateValidGraph(N, 14, K);
            BudgetTraveller.Result res = BudgetTraveller.solve(N, genFlights, K, C);
            if (res.minCost > 0 && res.path.size() - 1 <= K) {
                System.out.println("[PASS] Test 5: Generated graph is solvable within K stops (Cost = " + res.minCost + ")");
                passed++;
            } else {
                System.err.println("[FAIL] Test 5: Generated graph not solvable within K stops");
                failed++;
            }
        } catch (Exception e) {
            System.err.println("[FAIL] Test 5 Exception: " + e.getMessage());
            failed++;
        }

        System.out.println("\nSummary: " + passed + " passed, " + failed + " failed.");
        if (failed > 0) System.exit(1);
    }
}
