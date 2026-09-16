import React from "react";

// Composants
import { HomeHero, HomeFeatures, HomeRoiSimulator, HomeCTA } from "../components";

const Home = () => {
  return (
    <div className="home">
      <HomeHero />
      <HomeFeatures />
      <HomeRoiSimulator />
      <HomeCTA />
    </div>
  );
};

export default Home;
