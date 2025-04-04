import React, { useState, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import jsPDF from 'jspdf';
import VoiceInput from './VoiceInput';

interface ItemInput {
  itemName: string;
  brand: string;
  quantity: string;
  unit: string;
  priority: string;
  description: string;
  details: string;
}

interface FormInputs {
  customerName: string;
  favoriteShop: string;
  items: Array<{
    priority: string;
    itemName: string;
    brand: string;
    quantity: string;
    unit: string;
    description: string;
    details: string;
  }>;
}

const emptyItem: ItemInput = {
  itemName: '',
  brand: '',
  quantity: '',
  unit: '',
  priority: '',
  description: '',
  details: ''
};

const App: React.FC = () => {
  const [showThankYou, setShowThankYou] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const lastSpokenText = useRef('');
  
  const { register, control, handleSubmit, reset, setValue, getValues } = useForm<FormInputs>({
    defaultValues: {
      customerName: '',
      favoriteShop: '',
      items: [emptyItem]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items"
  });

  const analyzeDescription = async (index: number) => {
    const description = getValues(`items.${index}.description`);
    if (!description) {
      alert('Please fill in the description first');
      return;
    }

    try {
      // Get the base URL from the current window location
      const baseUrl = window.location.origin;
      const response = await fetch(`${baseUrl}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: description }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Analysis result:', result); // Debug log

      // Only update fields if they have values
      if (result.itemName) setValue(`items.${index}.itemName`, result.itemName);
      if (result.brand) setValue(`items.${index}.brand`, result.brand);
      if (result.quantity) setValue(`items.${index}.quantity`, result.quantity);
      if (result.unit) setValue(`items.${index}.unit`, result.unit);
      if (result.details) setValue(`items.${index}.details`, result.details);
      
      // Handle priority with exact case matching
      if (result.priority) {
        // Ensure priority matches the select options case exactly
        const priorityValue = result.priority.toUpperCase(); // Convert to uppercase to match select options
        console.log('Setting priority:', priorityValue); // Debug log
        if (['HIGH', 'MEDIUM', 'LOW'].includes(priorityValue)) {
          setValue(`items.${index}.priority`, priorityValue);
        } else {
          console.log('Invalid priority value:', priorityValue); // Debug log
        }
      } else {
        console.log('No priority value in result'); // Debug log
      }
      
      // Always preserve the original description
      setValue(`items.${index}.description`, description);
    } catch (error) {
      console.error('Error analyzing description:', error);
      alert('Failed to analyze the description. Please try again.');
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    let y = 20;
    const lineHeight = 10;
    const margin = 20;
    const maxWidth = 170;

    // Add title
    doc.setFontSize(20);
    doc.text('Shopping List', margin, y);
    y += lineHeight * 2;

    // Add date
    doc.setFontSize(12);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, margin, y);
    y += lineHeight * 1.5;

    // Add items
    doc.setFontSize(14);
    fields.forEach((_, index) => {
      const itemName = getValues(`items.${index}.itemName`) || '';
      const brand = getValues(`items.${index}.brand`) || '';
      const quantity = getValues(`items.${index}.quantity`) || '';
      const unit = getValues(`items.${index}.unit`) || '';
      const priority = getValues(`items.${index}.priority`) || '';
      const details = getValues(`items.${index}.details`) || '';

      // Item name with priority
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      const priorityText = priority ? ` [${priority}]` : '';
      doc.text(`${index + 1}. ${itemName}${priorityText}`, margin, y);
      y += lineHeight;

      // Brand, quantity and unit
      doc.setFont('helvetica', 'normal');
      const brandQtyText = `${brand ? brand + ' - ' : ''}${quantity} ${unit}`;
      doc.text(brandQtyText, margin + 10, y);
      y += lineHeight;

      // Details at the end
      if (details) {
        doc.setFontSize(12);
        const wrappedDetails = doc.splitTextToSize(`Details: ${details}`, maxWidth);
        doc.text(wrappedDetails, margin + 10, y);
        y += lineHeight * wrappedDetails.length;
      }

      y += lineHeight; // Add space between items
    });

    // Save the PDF
    doc.save('shopping_list.pdf');
  };

  const onSubmit = async (data: FormInputs) => {
    try {
      const response = await fetch('/api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        generatePDF();  // Generate PDF after successful submission
        setShowThankYou(true);
      } else {
        const errorData = await response.json();
        console.error('Submission failed:', errorData);
        alert('Failed to submit the form. Please try again.');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred while submitting the form. Please try again.');
    }
  };

  const createNewList = () => {
    reset({
      customerName: '',
      favoriteShop: '',
      items: [emptyItem]
    });
    setShowThankYou(false);
  };

  const handleTranscript = (text: string) => {
    lastSpokenText.current = text;
    setValue(`items.${fields.length - 1}.description`, text); // Set the text in the current item's description
  };

  const handleTranscriptCorrection = (original: string, corrected: string) => {
    console.log('Learned correction:', { original, corrected });
    // Store the correction in localStorage for future use
    try {
      const corrections = JSON.parse(localStorage.getItem('wordReplacements') || '{}');
      const words = original.toLowerCase().split(' ');
      const correctedWords = corrected.toLowerCase().split(' ');
      
      if (words.length === correctedWords.length) {
        words.forEach((word, index) => {
          if (word !== correctedWords[index]) {
            corrections[word.trim()] = correctedWords[index].trim();
          }
        });
        localStorage.setItem('wordReplacements', JSON.stringify(corrections));
      }
    } catch (error) {
      console.error('Error saving correction:', error);
    }
  };

  if (showThankYou) {
    return (
      <div className="thank-you">
        <h2>Thank you for your submission!</h2>
        <button onClick={createNewList}>Create New List</button>
      </div>
    );
  }

  return (
    <div className="form-container">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="customer-details">
          <input
            {...register('customerName', { required: true })}
            className="form-control"
            placeholder="Customer Name *"
            required
          />
          <input
            {...register('favoriteShop', { required: true })}
            className="form-control"
            placeholder="Favorite Shop *"
            required
          />
        </div>

        <div className="items-container">
          {fields.map((field, index) => (
            <div key={field.id} className="item-container">
              <div className="item-header">
                <h3>Item {index + 1}</h3>
              </div>

              <div className="form-row">
                <div className="description-container">
                  <textarea
                    {...register(`items.${index}.description`)}
                    placeholder="Text Analyzer (or use voice input).Ex:1 litre milk from Farm Fresh with medium priority and  Ensure they are fresh."
                    className="description-input"
                  />
                  <div className="button-container">
                    <button
                      type="button"
                      onClick={() => analyzeDescription(index)}
                      className="analyze-button"
                    >
                      Analyze
                    </button>
                    <div className="voice-input-container">
                      <VoiceInput
                        onTextReceived={handleTranscript}
                        isRecording={isRecording}
                        setIsRecording={setIsRecording}
                        onTranscriptCorrected={handleTranscriptCorrection}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-row">
                <input
                  {...register(`items.${index}.itemName`)}
                  placeholder="Item Name"
                  className="item-name-input"
                />
              </div>

              <div className="form-row">
                <input
                  {...register(`items.${index}.brand`)}
                  placeholder="Brand"
                  className="brand-input"
                />
              </div>

              <div className="form-row quantity-unit">
                <input
                  {...register(`items.${index}.quantity`)}
                  placeholder="Quantity"
                  className="quantity-input"
                />
                <select {...register(`items.${index}.unit`)} className="unit-select">
                  <option value="">Select Unit</option>
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="l">l</option>
                  <option value="ml">ml</option>
                  <option value="pcs">pcs</option>
                  <option value="dozen">dozen</option>
                  <option value="packet">packet</option>
                  <option value="box">box</option>
                </select>
              </div>

              <div className="form-row">
                <select {...register(`items.${index}.priority`)} className="priority-select">
                  <option value="">Select Priority</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>

              <div className="form-row">
                <input
                  {...register(`items.${index}.details`)}
                  placeholder="Additional Details"
                  className="details-input"
                />
              </div>

              {fields.length > 1 && (
                <button
                  type="button"
                  className="remove-button"
                  onClick={() => remove(index)}
                >
                  Remove Item
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          className="add-entry-button"
          onClick={() => append(emptyItem)}
        >
          + Add Item
        </button>

        <button type="submit" className="submit-button">
          Submit Shopping List
        </button>
      </form>
    </div>
  );
};

export default App;