import AppLayout from "../../Components/Layout/AppLayout";
import Dashboard from "../../Components/Dashboard/Dashboard";
import "./Homepage.scss";

function Homepage() {
  return (
    <AppLayout>
      <div className="homepage">
        <div className="dashboard">
          <div className="dashboard-section dashboard-section--main">
            <div className="section-content">
              <Dashboard />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default Homepage;
