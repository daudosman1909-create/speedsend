import { Platform } from "react-native";
import { Redirect } from "expo-router";
import WebDashboard from "../components/web/WebDashboard";

export default function Index() {
    if (Platform.OS === "web") {
        return <WebDashboard />;
    }
    return <Redirect href="/welcome" />;
}
