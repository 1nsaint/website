(() => {
  const enableFilament = document.getElementById('enableFilament');
  const enableElectricity = document.getElementById('enableElectricity');
  const filamentSection = document.getElementById('filamentSection');
  const electricitySection = document.getElementById('electricitySection');
  const calculateBtn = document.getElementById('calculateBtn');
  
  // Input fields
  const spoolCostInput = document.getElementById('spoolCost');
  const spoolWeightInput = document.getElementById('spoolWeight');
  const printWeightInput = document.getElementById('printWeight');
  const printerWattageInput = document.getElementById('printerWattage');
  const printTimeInput = document.getElementById('printTime');
  const electricityRateInput = document.getElementById('electricityRate');
  
  // Result elements
  const filamentResult = document.getElementById('filamentResult');
  const electricityResult = document.getElementById('electricityResult');
  const filamentCostEl = document.getElementById('filamentCost');
  const electricityCostEl = document.getElementById('electricityCost');
  const totalCostEl = document.getElementById('totalCost');
  const resultInfo = document.getElementById('resultInfo');

  // Toggle filament section
  enableFilament.addEventListener('change', () => {
    const enabled = enableFilament.checked;
    filamentSection.classList.toggle('input-section--disabled', !enabled);
    spoolCostInput.disabled = !enabled;
    spoolWeightInput.disabled = !enabled;
    printWeightInput.disabled = !enabled;
  });

  // Toggle electricity section
  enableElectricity.addEventListener('change', () => {
    const enabled = enableElectricity.checked;
    electricitySection.classList.toggle('input-section--disabled', !enabled);
    printerWattageInput.disabled = !enabled;
    printTimeInput.disabled = !enabled;
    electricityRateInput.disabled = !enabled;
  });

  // Calculate costs
  calculateBtn.addEventListener('click', () => {
    let filamentCost = 0;
    let electricityCost = 0;
    let hasErrors = false;
    let errorMessages = [];

    // Calculate filament cost
    if (enableFilament.checked) {
      const spoolCost = parseFloat(spoolCostInput.value);
      const spoolWeight = parseFloat(spoolWeightInput.value);
      const printWeight = parseFloat(printWeightInput.value);

      if (!spoolCost || !spoolWeight || !printWeight) {
        hasErrors = true;
        errorMessages.push('Please fill in all filament fields');
      } else if (spoolCost <= 0 || spoolWeight <= 0 || printWeight <= 0) {
        hasErrors = true;
        errorMessages.push('Filament values must be greater than 0');
      } else if (printWeight > spoolWeight) {
        hasErrors = true;
        errorMessages.push('Print weight cannot exceed spool weight');
      } else {
        filamentCost = (spoolCost / spoolWeight) * printWeight;
        filamentResult.style.display = 'flex';
        filamentCostEl.textContent = `$${filamentCost.toFixed(2)}`;
      }
    } else {
      filamentResult.style.display = 'none';
    }

    // Calculate electricity cost
    if (enableElectricity.checked) {
      const wattage = parseFloat(printerWattageInput.value);
      const hours = parseFloat(printTimeInput.value);
      const rate = parseFloat(electricityRateInput.value);

      if (!wattage || !hours || !rate) {
        hasErrors = true;
        errorMessages.push('Please fill in all electricity fields');
      } else if (wattage <= 0 || hours <= 0 || rate <= 0) {
        hasErrors = true;
        errorMessages.push('Electricity values must be greater than 0');
      } else {
        const kWh = (wattage * hours) / 1000;
        electricityCost = kWh * rate;
        electricityResult.style.display = 'flex';
        electricityCostEl.textContent = `$${electricityCost.toFixed(2)}`;
      }
    } else {
      electricityResult.style.display = 'none';
    }

    // Show errors or results
    if (hasErrors) {
      resultInfo.innerHTML = errorMessages.map(msg => `❌ ${msg}`).join('<br>');
      resultInfo.style.color = '#ff5252';
      totalCostEl.textContent = '$0.00';
      return;
    }

    if (!enableFilament.checked && !enableElectricity.checked) {
      resultInfo.textContent = 'Please enable at least one cost calculation option';
      resultInfo.style.color = 'var(--color-text-muted)';
      totalCostEl.textContent = '$0.00';
      return;
    }

    // Calculate total
    const totalCost = filamentCost + electricityCost;
    totalCostEl.textContent = `$${totalCost.toFixed(2)}`;

    // Build result info
    const infoParts = [];
    if (enableFilament.checked) {
      const costPerGram = filamentCost / parseFloat(printWeightInput.value);
      infoParts.push(`Filament: $${costPerGram.toFixed(4)}/g`);
    }
    if (enableElectricity.checked) {
      const kWh = (parseFloat(printerWattageInput.value) * parseFloat(printTimeInput.value)) / 1000;
      infoParts.push(`Energy: ${kWh.toFixed(3)} kWh`);
    }
    
    resultInfo.textContent = infoParts.join(' • ');
    resultInfo.style.color = 'var(--color-text-muted)';
  });

  // Allow Enter key to calculate
  document.querySelectorAll('input[type="number"]').forEach(input => {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        calculateBtn.click();
      }
    });
  });

  // Load saved values from localStorage
  const loadSavedValues = () => {
    const saved = localStorage.getItem('3d-calc-values');
    if (saved) {
      try {
        const values = JSON.parse(saved);
        if (values.spoolCost) spoolCostInput.value = values.spoolCost;
        if (values.spoolWeight) spoolWeightInput.value = values.spoolWeight;
        if (values.printerWattage) printerWattageInput.value = values.printerWattage;
        if (values.electricityRate) electricityRateInput.value = values.electricityRate;
      } catch (e) {
        console.error('Failed to load saved values', e);
      }
    } else {
      // Set defaults if nothing saved
      if (!spoolWeightInput.value) spoolWeightInput.value = '1000';
      if (!printerWattageInput.value) printerWattageInput.value = '300';
    }
  };

  // Save values to localStorage
  const saveValues = () => {
    const values = {
      spoolCost: spoolCostInput.value,
      spoolWeight: spoolWeightInput.value,
      printerWattage: printerWattageInput.value,
      electricityRate: electricityRateInput.value
    };
    localStorage.setItem('3d-calc-values', JSON.stringify(values));
  };

  // Auto-save on input change
  [spoolCostInput, spoolWeightInput, printerWattageInput, electricityRateInput].forEach(input => {
    input.addEventListener('change', saveValues);
  });

  // Load values on page load
  loadSavedValues();
})();

