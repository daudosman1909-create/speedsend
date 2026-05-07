import React, { useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "./lib/theme";

const PACKAGE_SIZES = [
  { id: "small", name: "Small", description: "Documents and small packages", price: 5.99 },
  { id: "medium", name: "Medium", description: "Laptops, accessories, and boxes", price: 9.49 },
  { id: "large", name: "Large", description: "Bulky boxes and crates", price: 13.99 },
  { id: "xl", name: "Extra Large", description: "Furniture and appliances", price: 21.99 },
];

const DELIVERY_SPEEDS = [
  { id: "standard", name: "Standard", description: "2-3 business days", multiplier: 1, eta: "2-3 days" },
  { id: "express", name: "Express", description: "Next business day", multiplier: 1.5, eta: "Tomorrow" },
  { id: "same-day", name: "Same Day", description: "Today if ordered before 2 PM", multiplier: 2, eta: "Today" },
];

export default function App() {
  const [pickupAddress, setPickupAddress] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [packageSize, setPackageSize] = useState<string | null>(null);
  const [deliverySpeed, setDeliverySpeed] = useState<string | null>(null);
  const [trackingMode, setTrackingMode] = useState(false);

  const selectedPackage = PACKAGE_SIZES.find((item) => item.id === packageSize);
  const selectedSpeed = DELIVERY_SPEEDS.find((item) => item.id === deliverySpeed);
  const totalPrice = selectedPackage ? selectedPackage.price * (selectedSpeed?.multiplier ?? 1) : 0;

  const handleBook = () => {
    if (!pickupAddress || !deliveryAddress || !packageSize || !deliverySpeed) {
      Alert.alert("Fill all fields", "Please select an address, package size, and delivery speed.");
      return;
    }

    Alert.alert(
      "Booked!",
      `Delivery from ${pickupAddress} to ${deliveryAddress} is confirmed for $${totalPrice.toFixed(2)}. Estimated delivery: ${selectedSpeed?.eta}.`,
      [
        { text: "Track", onPress: () => setTrackingMode(true) },
        { text: "Done" },
      ]
    );
  };

  if (trackingMode) {
    return (
      <View style={styles.trackingScreen}>
        <View style={styles.trackingHeader}>
          <Pressable onPress={() => setTrackingMode(false)} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </Pressable>
          <Text style={styles.trackingTitle}>Delivery Tracking</Text>
        </View>
        <View style={styles.trackingCard}>
          <Text style={styles.sectionTitle}>Current status</Text>
          <View style={styles.stepRow}>
            <View style={[styles.stepIndicator, styles.stepComplete]}>
              <Ionicons name="checkmark" size={16} color={theme.accentForeground} />
            </View>
            <Text style={styles.stepLabel}>Order received</Text>
          </View>
          <View style={styles.stepRow}>
            <View style={[styles.stepIndicator, styles.stepComplete]}>
              <Ionicons name="checkmark" size={16} color={theme.accentForeground} />
            </View>
            <Text style={styles.stepLabel}>Picked up by courier</Text>
          </View>
          <View style={styles.stepRow}>
            <View style={[styles.stepIndicator, styles.stepActive]}>
              <Ionicons name="car" size={16} color={theme.accentForeground} />
            </View>
            <Text style={styles.stepLabel}>In transit</Text>
          </View>
          <View style={styles.stepRow}>
            <View style={styles.stepIndicator}>
              <Ionicons name="home" size={16} color={theme.textSecondary} />
            </View>
            <Text style={styles.stepLabel}>Delivered</Text>
          </View>
          <View style={styles.trackSummary}>
            <Text style={styles.summaryLabel}>ETA</Text>
            <Text style={styles.summaryValue}>{selectedSpeed?.eta ?? "Today"}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.brand}>SpeedSend</Text>
      <Text style={styles.subtitle}>Fast delivery for packages, documents, and more.</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pickup address</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter pickup location"
          placeholderTextColor={theme.textSecondary}
          value={pickupAddress}
          onChangeText={setPickupAddress}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Delivery address</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter delivery location"
          placeholderTextColor={theme.textSecondary}
          value={deliveryAddress}
          onChangeText={setDeliveryAddress}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Package size</Text>
        <View style={styles.optionGrid}>
          {PACKAGE_SIZES.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setPackageSize(item.id)}
              style={[
                styles.optionCard,
                packageSize === item.id && styles.optionSelected,
              ]}
            >
              <Text style={styles.optionTitle}>{item.name}</Text>
              <Text style={styles.optionDesc}>{item.description}</Text>
              <Text style={styles.optionPrice}>${item.price.toFixed(2)}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Delivery speed</Text>
        <View style={styles.optionGrid}>
          {DELIVERY_SPEEDS.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setDeliverySpeed(item.id)}
              style={[
                styles.optionCard,
                deliverySpeed === item.id && styles.optionSelected,
              ]}
            >
              <Text style={styles.optionTitle}>{item.name}</Text>
              <Text style={styles.optionDesc}>{item.description}</Text>
              <Text style={styles.optionPrice}>{item.eta}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {selectedPackage && selectedSpeed ? (
        <View style={styles.priceBar}>
          <Text style={styles.priceLabel}>Price estimate</Text>
          <Text style={styles.priceValue}>${totalPrice.toFixed(2)}</Text>
        </View>
      ) : null}

      <Pressable
        style={[styles.bookButton, !(pickupAddress && deliveryAddress && packageSize && deliverySpeed) && styles.bookButtonDisabled]}
        onPress={handleBook}
        disabled={!(pickupAddress && deliveryAddress && packageSize && deliverySpeed)}
      >
        <Text style={styles.bookButtonText}>Book delivery</Text>
      </Pressable>

      <View style={styles.footerCard}>
        <Text style={styles.footerTitle}>Track your delivery</Text>
        <Text style={styles.footerText}>
          Get real-time updates from pickup to drop-off with live tracking and delivery status.
        </Text>
        <Pressable style={styles.trackButton} onPress={() => setTrackingMode(true)}>
          <Text style={styles.trackButtonText}>View tracking</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: Platform.OS === "web" ? 40 : 32,
  },
  brand: {
    color: theme.accent,
    fontSize: 34,
    fontWeight: "800",
    marginBottom: 6,
  },
  subtitle: {
    color: theme.textSecondary,
    fontSize: 16,
    marginBottom: 24,
    maxWidth: 520,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: theme.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  input: {
    backgroundColor: theme.panel,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    color: theme.text,
    fontSize: 16,
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  optionCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  optionSelected: {
    borderColor: theme.accent,
    backgroundColor: theme.accentSoft,
  },
  optionTitle: {
    color: theme.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  optionDesc: {
    color: theme.textSecondary,
    fontSize: 14,
    marginBottom: 10,
  },
  optionPrice: {
    color: theme.accent,
    fontSize: 16,
    fontWeight: "700",
  },
  priceBar: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 16,
    padding: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  priceLabel: {
    color: theme.textSecondary,
    fontSize: 14,
  },
  priceValue: {
    color: theme.text,
    fontSize: 24,
    fontWeight: "800",
  },
  bookButton: {
    backgroundColor: theme.accent,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: 24,
  },
  bookButtonDisabled: {
    opacity: 0.45,
  },
  bookButtonText: {
    color: theme.accentForeground,
    fontSize: 16,
    fontWeight: "800",
  },
  footerCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.border,
  },
  footerTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
  },
  footerText: {
    color: theme.textSecondary,
    fontSize: 15,
    marginBottom: 16,
    lineHeight: 22,
  },
  trackButton: {
    backgroundColor: theme.panel,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  trackButtonText: {
    color: theme.text,
    fontSize: 15,
    fontWeight: "700",
  },
  trackingScreen: {
    flex: 1,
    backgroundColor: theme.bg,
    padding: 20,
    paddingTop: Platform.OS === "web" ? 40 : 24,
  },
  trackingHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  backButton: {
    marginRight: 16,
  },
  trackingTitle: {
    color: theme.text,
    fontSize: 24,
    fontWeight: "800",
  },
  trackingCard: {
    backgroundColor: theme.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 22,
    gap: 22,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  stepIndicator: {
    width: 42,
    height: 42,
    borderRadius: 22,
    backgroundColor: theme.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepComplete: {
    backgroundColor: theme.success,
  },
  stepActive: {
    backgroundColor: theme.accent,
  },
  stepLabel: {
    color: theme.text,
    fontSize: 16,
  },
  summaryLabel: {
    color: theme.textSecondary,
    fontSize: 14,
    marginBottom: 4,
  },
  summaryValue: {
    color: theme.text,
    fontSize: 20,
    fontWeight: "800",
  },
});