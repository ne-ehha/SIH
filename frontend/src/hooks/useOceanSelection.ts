import { useOceanStore } from '@/state/oceanStore';
import { useCallback } from 'react';
import type { Location } from '@/types/ocean';

export function useOceanSelection() {
  const {
    selectedLocation,
    selectedDepth,
    selectedVariable,
    selectedDate,
    selectedTime,
    selectedRegion,
    setSelectedLocation,
    setSelectedDepth,
    setSelectedVariable,
    setSelectedDate,
    setSelectedTime,
    setSelectedRegion,
    resetSelection,
  } = useOceanStore();

  const handleLocationSelect = useCallback(
    (location: Location) => {
      setSelectedLocation(location);
    },
    [setSelectedLocation]
  );

  const hasSelection = selectedLocation !== null;

  return {
    selectedLocation,
    selectedDepth,
    selectedVariable,
    selectedDate,
    selectedTime,
    selectedRegion,
    hasSelection,
    handleLocationSelect,
    setSelectedDepth,
    setSelectedVariable,
    setSelectedDate,
    setSelectedTime,
    setSelectedRegion,
    resetSelection,
  };
}
