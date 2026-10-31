import { useState, useEffect, useCallback } from "react";
import "./dashboard.css";
import NewSHBill from "./NewSHBill.jsx";
import SHCustomers from "./SHCustomers.jsx";
import NewGIBill from "./NewGi.jsx";
import GICustomer from "./GICustomer.jsx";
import GIHistory from "./GIHistory";
import GIStatistics from "./GIStatistics";




const modules = [
  { label: "Dashboard", icon: "▦" },
  { label: "NEW SH Bill", icon: "▤" },
  { label: "SH Customers", icon: "♙" },
  { label: "NEW GI", icon: "+" },
  { label: "GI Customer", icon: "♧" },
  { label: "GI History", icon: "◷" },
  { label: "GI Statistics", icon: "▥" },

];

const currency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);

function Dashboard({ user, onNavigate, onLogout }) {
  const [activeModule, setActiveModule] = useState("Dashboard");
  const [dashboardData, setDashboardData] = useState({
    todaySales: 0,
    shCustomers: 0,
    activeGI: 0,
    completedGI: 0,
    girviAccounts: [],
    activities: []
  });

  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");

  const navigateTo = (module) => {
    setActiveModule(module);


    if (onNavigate) {
      onNavigate(module);
    }


  };
  const fetchDashboardData = useCallback(async () => {
    try {
      setDashboardLoading(true);
      setDashboardError("");

      const [
        billsResponse,
        customersResponse,
        activeGIResponse,
        completedGIResponse
      ] = await Promise.all([
        fetch("http://localhost:5000/api/sh-bills/"),
        fetch("http://localhost:5000/api/sh-bills/customers"),
        fetch("http://localhost:5000/api/gi/customers?filter=active"),
        fetch("http://localhost:5000/api/gi/customers?filter=completed")
      ]);

      const responses = [
        billsResponse,
        customersResponse,
        activeGIResponse,
        completedGIResponse
      ];

      if (responses.some(response => !response.ok)) {
        throw new Error("Unable to fetch dashboard data.");
      }

      const [
        billsData,
        customersData,
        activeGIData,
        completedGIData
      ] = await Promise.all(
        responses.map(response => response.json())
      );

      if (
        !billsData.success ||
        !customersData.success ||
        !activeGIData.success ||
        !completedGIData.success
      ) {
        throw new Error("Backend returned an unsuccessful response.");
      }

      // Extract API arrays
      const bills = billsData.bills || billsData.data || [];
      const customers =
        customersData.customers || customersData.data || [];

      const activeAccounts = activeGIData.customers || [];
      const completedAccounts = completedGIData.customers || [];

      // Today's date
      const today = new Date().toLocaleDateString("en-CA");

      // Calculate today's SH sales
      const todaySales = bills.reduce((total, bill) => {
        const billDate = String(
          bill.bill_date || bill.created_at || bill.date || ""
        ).slice(0, 10);

        const billAmount = Number(
          bill.total_amount ??
          bill.grand_total ??
          bill.total ??
          bill.bill_amount ??
          0
        );

        if (billDate === today) {
          return total + billAmount;
        }

        return total;
      }, 0);

      // Prepare active GI table
      const girviAccounts = activeAccounts.map(account => ({
        id: account.gi_number,
        customer: account.customer_name,
        item: account.item_names || "-",
        amount: Number(account.original_principal || account.principal || 0),
        date: account.gi_date,
        status: "Due"
      }));

      // Recent activity
      const activities = [];

      bills.forEach(bill => {
        activities.push({
          text: `New SH bill created · ${bill.bill_number || bill.invoice_number || bill.id}`,
          date: bill.created_at || bill.bill_date
        });
      });

      activeAccounts.forEach(account => {
        activities.push({
          text: `GI account created · ${account.gi_number}`,
          date: account.created_at || account.gi_date
        });
      });

      completedAccounts.forEach(account => {
        activities.push({
          text: `GI account completed · ${account.gi_number}`,
          date: account.completed_at
        });
      });

      // Sort latest activity first
      activities.sort((a, b) =>
        new Date(b.date || 0) - new Date(a.date || 0)
      );

      setDashboardData({
        todaySales,
        shCustomers: customers.length,
        activeGI: activeAccounts.length,
        completedGI: completedAccounts.length,
        girviAccounts,
        activities: activities.slice(0, 5)
      });

    } catch (error) {
      console.error("Dashboard API Error:", error);
      setDashboardError(error.message);
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);
  return (<div className="sh-dashboard">


    {/* Sidebar + Main Content */}
    <div className="sh-dashboard-body">
      {/* Left Sidebar */}
      <aside className="sh-sidebar">
        <div className="sh-sidebar-brand">
          <div className="sh-sidebar-logo">◇</div>

          <div>
            <h2>Pranali Jewellery</h2>
            <p>Billing &amp; Girvi Management</p>
          </div>
        </div>

        <p className="sh-sidebar-label">MAIN DOMAINS</p>

        <nav className="sh-sidebar-navigation">
          {modules.map((module) => (
            <button
              key={module.label}
              type="button"
              className={`sh-sidebar-link ${activeModule === module.label ? "active" : ""
                }`}
              onClick={() => navigateTo(module.label)}
            >
              <span className="sh-nav-icon">{module.icon}</span>
              <span>{module.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-logout">
          <button
            type="button"
            className="logout-button"
            onClick={onLogout}
          >
            <span className="logout-icon">↪</span>
            <span>Logout</span>
          </button>
        </div>
        <div className="sh-sidebar-footer">
          Pranali Jewellery - By Prakash Dixit
        </div>
      </aside>

      {/* Main Content */}
      <main className="sh-dashboard-content">
        {activeModule === "Dashboard" ? (
          <>
            {/* Dashboard Heading */}
            <section className="sh-page-heading">
              <div>
                <h1>Pranali Jewellers</h1>
                <p>
                  Welcome back. Here's your shop activity at a glance.
                </p>
              </div>
              <button
                type="button"
                className="sh-button sh-button-gold sh-heading-button"
                onClick={fetchDashboardData}
              >
                ↻ Refresh
              </button>

              <button
                type="button"
                className="sh-button sh-button-gold sh-heading-button"
                onClick={() => navigateTo("NEW SH Bill")}
              >
                + New SH Bill
              </button>
            </section>

            {/* Summary Cards */}
            <section className="sh-stats-grid">
              <article className="sh-stat-card">
                <div className="sh-stat-information">
                  <p>Today's SH Sales</p>
                  <h2>
                    {dashboardLoading
                      ? "..."
                      : currency(dashboardData.todaySales)}
                  </h2>
                  <span>Sales billing</span>
                </div>

                <div className="sh-stat-icon">₹</div>
              </article>

              <article className="sh-stat-card">
                <div className="sh-stat-information">
                  <p>SH Customers</p>
                  <h2>
                    {dashboardLoading
                      ? "..."
                      : dashboardData.shCustomers}
                  </h2>
                  <span>Customer records</span>
                </div>

                <div className="sh-stat-icon">♙</div>
              </article>

              <article className="sh-stat-card">
                <div className="sh-stat-information">
                  <p>Active GI Accounts</p>
                  <h2>
                    {dashboardLoading
                      ? "..."
                      : dashboardData.activeGI}
                  </h2>
                  <span>Girvi transactions</span>
                </div>

                <div className="sh-stat-icon">◇</div>
              </article>

              <article className="sh-stat-card">
                <div className="sh-stat-information">
                  <p>Completed GI</p>
                  <h2>
                    {dashboardLoading
                      ? "..."
                      : dashboardData.completedGI}
                  </h2>
                  <span>No dues</span>
                </div>

                <div className="sh-stat-icon">✓</div>
              </article>
            </section>

            {/* Quick Actions + Recent Activity */}
            <section className="sh-overview-grid">
              <article className="sh-panel sh-quick-actions">
                <h2>Quick Actions</h2>

                <div className="sh-actions-grid">
                  <button
                    type="button"
                    className="sh-button sh-button-gold"
                    onClick={() => navigateTo("NEW SH Bill")}
                  >
                    + New SH Bill
                  </button>

                  <button
                    type="button"
                    className="sh-button sh-button-outline"
                    onClick={() => navigateTo("SH Customers")}
                  >
                    ♙ SH Customers
                  </button>

                  <button
                    type="button"
                    className="sh-button sh-button-gold"
                    onClick={() => navigateTo("NEW GI")}
                  >
                    + New GI Entry
                  </button>

                  <button
                    type="button"
                    className="sh-button sh-button-outline"
                    onClick={() => navigateTo("GI Customer")}
                  >
                    ♧ Active GI Customers
                  </button>
                </div>

                <p className="sh-panel-hint">
                  Use the left navigation to switch between your main
                  business modules.
                </p>
              </article>

              <article className="sh-panel sh-recent-activity">
                <h2>Recent Activity</h2>

                <div className="sh-activity-list">

                  {dashboardLoading ? (
                    <p>Loading activities...</p>
                  ) : dashboardData.activities.length === 0 ? (
                    <p>No recent activity found.</p>
                  ) : (
                    dashboardData.activities.map((activity, index) => (
                      <div
                        className="sh-activity-row"
                        key={index}
                      >
                        <span>{activity.text}</span>

                        <time>
                          {activity.date
                            ? new Date(activity.date).toLocaleDateString("en-IN")
                            : "-"}
                        </time>
                      </div>
                    ))
                  )}

                </div>
              </article>
            </section>

            {/* Active Girvi Accounts */}
            <section className="sh-panel sh-girvi-panel">
              <h2>Active Girvi Accounts</h2>

              <div className="sh-table-wrapper">
                <table className="sh-girvi-table">
                  <thead>
                    <tr>
                      <th>GI ID</th>
                      <th>Customer</th>
                      <th>Item</th>
                      <th>Loan Amount</th>
                      <th>Start Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {dashboardLoading ? (
                      <tr>
                        <td colSpan="6">Loading GI accounts...</td>
                      </tr>
                    ) : dashboardData.girviAccounts.length === 0 ? (
                      <tr>
                        <td colSpan="6">No active GI accounts found.</td>
                      </tr>
                    ) : (
                      dashboardData.girviAccounts.slice(0, 5).map((account) => (
                        <tr key={account.id}>
                          <td>{account.id}</td>
                          <td>{account.customer}</td>
                          <td>{account.item}</td>
                          <td>{currency(account.amount)}</td>
                          <td>
                            {account.date
                              ? new Date(account.date).toLocaleDateString("en-IN")
                              : "-"}
                          </td>
                          <td>
                            <span className="sh-status sh-status-due">
                              {account.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <footer className="sh-dashboard-footer">
              Pranali Jewellery Billing &amp; Girvi Management
            </footer>
          </>
        ) : activeModule === "NEW SH Bill" ? (
          /* NEW SH Bill Page */
          <NewSHBill onNavigate={navigateTo} />
        ) : activeModule === "SH Customers" ? (
          /* SH Customers Page */
          <SHCustomers />
        ) : activeModule === "NEW GI" ? (
          /* NEW GI Page */
          <NewGIBill />
        ) : activeModule === "GI Customer" ? (
          <GICustomer />
        ) : activeModule === "GI History" ? (
          <GIHistory />
        ) : activeModule === "GI Statistics" ? (
          <GIStatistics />
        ) : (
          /* Other Modules */
          <section className="sh-module-placeholder">
            <div className="sh-stat-icon">◇</div>
            <h1>{activeModule}</h1>
            <p>The {activeModule} module will be developed next.</p>
            <button
              type="button"
              className="sh-button sh-button-gold"
              onClick={() => navigateTo("Dashboard")}
            >
              ← Back to Dashboard
            </button>
          </section>
        )}
      </main>
    </div>
  </div>
  );
}

export default Dashboard;
