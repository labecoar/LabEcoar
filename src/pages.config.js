/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AdminApplications from './pages/AdminApplications';
import AdminApproval from './pages/AdminApproval';
import AdminContentManagement from './pages/AdminContentManagement';
import Dashboard from './pages/Dashboard';
import Forum from './pages/Forum';
import Leaderboard from './pages/Leaderboard';
import Login from './pages/Login';
import MyPayments from './pages/MyPayments';
import MySubmissions from './pages/MySubmissions';
import Profile from './pages/Profile';
import Rewards from './pages/Rewards';
import Tasks from './pages/Tasks';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminApplications": AdminApplications,
    "AdminApproval": AdminApproval,
    "AdminContentManagement": AdminContentManagement,
    "Dashboard": Dashboard,
    "Forum": Forum,
    "Leaderboard": Leaderboard,
    "Login": Login,
    "MyPayments": MyPayments,
    "MySubmissions": MySubmissions,
    "Profile": Profile,
    "Rewards": Rewards,
    "Tasks": Tasks,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};