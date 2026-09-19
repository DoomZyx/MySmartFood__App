import Dashboard from "../../Components/Dashboard/Dashboard";
import "./Homepage.scss";

function Homepage() {
  return (
    <div className="homepage">
      <div className="dashboard">
        <div className="dashboard-section dashboard-section--main">
          <div className="section-content">
            <Dashboard />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Homepage;
