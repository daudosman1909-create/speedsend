import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/lib/theme";

interface PackageSize {
  id: string;
  name: string;
  description: string;
  price: number;
}

interface DeliverySpeed {
  id: string;
  name: string;
  description: string;
  multiplier: number;
  eta: string;
}

const PACKAGE_SIZES: PackageSize[] = [
  { id: 'small', name: 'Small', description: 'Documents, small items', price: 5.99 },
  { id: 'medium', name: 'Medium', description: 'Laptop, small electronics', price: 8.99 },
  { id: 'large', name: 'Large', description: 'Large boxes, furniture', price: 12.99 },
  { id: 'xl', name: 'Extra Large', description: 'Heavy items, appliances', price: 19.99 },
];

const DELIVERY_SPEEDS: DeliverySpeed[] = [
  { id: 'standard', name: 'Standard', description: '2-3 business days', multiplier: 1, eta: '2-3 days' },
  { id: 'express', name: 'Express', description: 'Next business day', multiplier: 1.5, eta: 'Tomorrow' },
  { id: 'same-day', name: 'Same Day', description: 'Today if ordered before 2 PM', multiplier: 2, eta: 'Today' },
];

export default function Index() {
  const [pickupAddress, setPickupAddress] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [selectedSpeed, setSelectedSpeed] = useState<string | null>(null);
  const [showTracking, setShowTracking] = useState(false);

  const selectedPackageData = PACKAGE_SIZES.find(p => p.id === selectedPackage);
  const selectedSpeedData = DELIVERY_SPEEDS.find(s => s.id === selectedSpeed);

  const basePrice = selectedPackageData?.price || 0;
  const speedMultiplier = selectedSpeedData?.multiplier || 1;
  const totalPrice = basePrice * speedMultiplier;

  const handleBookDelivery = () => {
    if (!pickupAddress || !deliveryAddress || !selectedPackage || !selectedSpeed) {
      Alert.alert('Missing Information', 'Please fill in all fields and select package size and delivery speed.');
      return;
    }

    Alert.alert(
      'Booking Confirmed!',
      `Your delivery from ${pickupAddress} to ${deliveryAddress} has been booked for $${totalPrice.toFixed(2)}. Estimated delivery: ${selectedSpeedData?.eta}`,
      [
        { text: 'Track Order', onPress: () => setShowTracking(true) },
        { text: 'OK' }
      ]
    );
  };

  if (showTracking) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => setShowTracking(false)} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </Pressable>
          <Text style={styles.title}>Track Your Delivery</Text>
        </View>

        <View style={styles.trackingContainer}>
          <View style={styles.trackingStep}>
            <View style={[styles.stepIndicator, styles.stepCompleted]}>
              <Ionicons name="checkmark" size={16} color={theme.accentForeground} />
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Order Placed</Text>
              <Text style={styles.stepTime}>2 hours ago</Text>
            </View>
          </View>

          <View style={styles.trackingStep}>
            <View style={[styles.stepIndicator, styles.stepCompleted]}>
              <Ionicons name="checkmark" size={16} color={theme.accentForeground} />
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Picked Up</Text>
              <Text style={styles.stepTime}>1 hour ago</Text>
            </View>
          </View>

          <View style={styles.trackingStep}>
            <View style={[styles.stepIndicator, styles.stepActive]}>
              <Ionicons name="car" size={16} color={theme.accentForeground} />
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>In Transit</Text>
              <Text style={styles.stepTime}>Estimated delivery: Today 4:30 PM</Text>
            </View>
          </View>

          <View style={styles.trackingStep}>
            <View style={styles.stepIndicator}>
              <Ionicons name="home" size={16} color={theme.textSecondary} />
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Delivered</Text>
              <Text style={styles.stepTime}>Pending</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>SpeedSend</Text>
          <Text style={styles.subtitle}>Fast, reliable delivery</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Pickup Address</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter pickup location"
              value={pickupAddress}
              onChangeText={setPickupAddress}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Delivery Address</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter delivery location"
              value={deliveryAddress}
              onChangeText={setDeliveryAddress}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Package Size</Text>
            <View style={styles.optionsGrid}>
              {PACKAGE_SIZES.map((pkg) => (
                <Pressable
                  key={pkg.id}
                  style={[
                    styles.optionCard,
                    selectedPackage === pkg.id && styles.optionSelected
                  ]}
                  onPress={() => setSelectedPackage(pkg.id)}
                >
                  <Text style={styles.optionTitle}>{pkg.name}</Text>
                  <Text style={styles.optionDesc}>{pkg.description}</Text>
                  <Text style={styles.optionPrice}>${pkg.price.toFixed(2)}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Delivery Speed</Text>
            <View style={styles.optionsGrid}>
              {DELIVERY_SPEEDS.map((speed) => (
                <Pressable
                  key={speed.id}
                  style={[
                    styles.optionCard,
                    selectedSpeed === speed.id && styles.optionSelected
                  ]}
                  onPress={() => setSelectedSpeed(speed.id)}
                >
                  <Text style={styles.optionTitle}>{speed.name}</Text>
                  <Text style={styles.optionDesc}>{speed.description}</Text>
                  <Text style={styles.optionPrice}>
                    {speed.multiplier > 1 ? `${(speed.multiplier * 100).toFixed(0)}% more` : 'Standard'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {totalPrice > 0 && (
            <View style={styles.priceEstimate}>
              <Text style={styles.priceLabel}>Total Price:</Text>
              <Text style={styles.priceAmount}>${totalPrice.toFixed(2)}</Text>
            </View>
          )}

          <Pressable
            style={[
              styles.bookButton,
              (!pickupAddress || !deliveryAddress || !selectedPackage || !selectedSpeed) && styles.bookButtonDisabled
            ]}
            onPress={handleBookDelivery}
            disabled={!pickupAddress || !deliveryAddress || !selectedPackage || !selectedSpeed}
          >
            <Text style={styles.bookButtonText}>Book Delivery</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  content: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  form: {
    gap: 24,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: theme.panel,
    color: theme.text,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  optionCard: {
    flex: 1,
    minWidth: 140,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    backgroundColor: theme.card,
    gap: 4,
  },
  optionSelected: {
    borderColor: theme.accent,
    backgroundColor: theme.accentSoft,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  optionDesc: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  optionPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.accent,
  },
  priceEstimate: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  priceLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
  },
  priceAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.accent,
  },
  bookButton: {
    backgroundColor: theme.accent,
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
  },
  bookButtonDisabled: {
    backgroundColor: theme.textSecondary,
    opacity: 0.5,
  },
  bookButtonText: {
    color: theme.accentForeground,
    fontSize: 18,
    fontWeight: '600',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    padding: 8,
  },
  trackingContainer: {
    padding: 20,
    gap: 24,
  },
  trackingStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  stepIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCompleted: {
    backgroundColor: theme.success,
  },
  stepActive: {
    backgroundColor: theme.accent,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  stepTime: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 2,
  },
});
