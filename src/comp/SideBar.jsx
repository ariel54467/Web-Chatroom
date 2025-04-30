import React from "react";
import { Navigation } from "./Navigation";
import { People } from "./People";

export const SideBar = () => {
    return (
        <div className="sidebar">
            <Navigation />
            <People />
        </div>
    )
}