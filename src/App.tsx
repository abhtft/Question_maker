import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import './styles/QuestionMaker.css';

interface TopicInput {
  sectionName: string;
  topicNotes: string;
  questionType: string;
  difficulty: string;
  bloomLevel: string;
  intelligenceType: string;
  numQuestions: string;
  additionalInstructions: string;
}

interface FormInputs {
  subjectName: string;
  classGrade: string;
  language: string;
  topics: TopicInput[];
}

const emptyTopic: TopicInput = {
  sectionName: '',
  topicNotes: '',
  questionType: '',
  difficulty: '',
  bloomLevel: '',
  intelligenceType: '',
  numQuestions: '',
  additionalInstructions: ''
};

const intelligenceSubtypes = {
  Logical: [
    "Pattern solving", "Deductive reasoning", "Coding logic", "Data interpretation"
  ],
  Linguistic: [
    "Storytelling", "Persuasive argument", "Vocabulary building", "Creative writing"
  ],
  Kinesthetic: [
    "Gross motor (e.g., sports)", "Fine motor (e.g., drawing)", "Simulations"
  ],
  Spatial: [
    "3D visualization", "Map reading", "Mental rotation", "Blueprint understanding"
  ],
  Musical: [
    "Rhythm patterns", "Composition", "Tone recognition"
  ],
  Interpersonal: [
    "Negotiation skills", "Group collaboration", "Empathy exercises"
  ],
  Intrapersonal: [
    "Self-assessment", "Reflective writing", "Goal setting"
  ],
  Naturalistic: [
    "Classification tasks", "Field observations", "Environmental problem-solving"
  ]
};

const App: React.FC = () => {
  const { register, control, handleSubmit } = useForm<FormInputs>({
    defaultValues: {
      subjectName: '',
      classGrade: '',
      language: '',
      topics: [emptyTopic]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "topics"
  });

  const [intelligenceType, setIntelligenceType] = useState("");
  const [intelligenceSubType, setIntelligenceSubType] = useState("");

  const onSubmit = async (data: FormInputs) => {
    try {
      const response = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to generate questions');
      }

      const result = await response.json();

      if (result.success) {
        // Redirect to thank you page with the PDF URL as a query parameter
        window.location.href = `/thankyou.html?pdf=${encodeURIComponent(result.pdf_url)}`;
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to generate questions. Please try again.');
    }
  };

  return (
    <div className="question-maker-container">
      <h1>Question Maker</h1>
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Basic Info Section */}
        <div className="basic-info-section">
          <h2>Basic Information</h2>
          <div className="form-group">
            <label>Subject Name *</label>
            <input {...register("subjectName", { required: true })} />
          </div>
          <div className="form-group">
            <label>Class/Grade *</label>
            <input {...register("classGrade", { required: true })} />
          </div>
          <div className="form-group">
            <label>Language *</label>
            <select {...register("language", { required: true })}>
              <option value="">Select Language</option>
              <option value="English">English</option>
              <option value="Hindi">Hindi</option>
            </select>
          </div>
        </div>
        {/* Topics Section */}
        <div className="topics-section">
          <h2>Topics</h2>
          {fields.map((field, index) => (
            <div key={field.id} className="topic-block">
              <h3>Topic {index + 1}</h3>
              <div className="form-group">
                <label>Section/Topic Name *</label>
                <input {...register(`topics.${index}.sectionName`, { required: true })} />
              </div>
              <div className="form-group">
                <label>Topic Notes</label>
                <textarea {...register(`topics.${index}.topicNotes`)} />
              </div>
              <div className="form-group">
                <label>Question Type *</label>
                <select {...register(`topics.${index}.questionType`, { required: true })}>
                  <option value="">Select Type</option>
                  <option value="MCQ">MCQ</option>
                  <option value="Short">Short Answer</option>
                  <option value="Long">Long Answer</option>
                  <option value="Fill Blanks">Fill in the Blanks</option>
                </select>
              </div>
              <div className="form-group">
                <label>Difficulty *</label>
                <select {...register(`topics.${index}.difficulty`, { required: true })}>
                  <option value="">Select Difficulty</option>
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>
              <div className="form-group">
                <label>Bloom's Level *</label>
                <select {...register(`topics.${index}.bloomLevel`, { required: true })}>
                  <option value="">Select Level</option>
                  <option value="Remember">Remember</option>
                  <option value="Understand">Understand</option>
                  <option value="Apply">Apply</option>
                  <option value="Analyze">Analyze</option>
                  <option value="Evaluate">Evaluate</option>
                  <option value="Create">Create</option>
                </select>
              </div>
              <div className="form-group">
                <label>Intelligence Type *</label>
                <select
                  value={intelligenceType}
                  onChange={e => {
                    setIntelligenceType(e.target.value);
                    setIntelligenceSubType(""); // reset subtype
                  }}
                >
                  <option value="">Select Intelligence Type</option>
                  {Object.keys(intelligenceSubtypes).map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              {intelligenceType && (
                <select
                  value={intelligenceSubType}
                  onChange={e => setIntelligenceSubType(e.target.value)}
                >
                  <option value="">Select SubType</option>
                  {(intelligenceSubtypes[intelligenceType as keyof typeof intelligenceSubtypes] || []).map((sub: string) => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              )}
              <div className="form-group">
                <label>Number of Questions *</label>
                <input
                  type="number"
                  {...register(`topics.${index}.numQuestions`, { required: true, min: 1 })}
                />
              </div>
              <div className="form-group">
                <label>Additional Instructions</label>
                <textarea {...register(`topics.${index}.additionalInstructions`)} />
              </div>
              {index > 0 && (
                <button type="button" onClick={() => remove(index)}>
                  Remove Topic
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => append(emptyTopic)}>
            + Add Topic
          </button>
        </div>
        <div className="submit-section">
          <button type="submit">Submit Paper Request</button>
        </div>
      </form>
    </div>
  );
};

export default App;