// Import required modules
const express = require("express");

// Create an Express application
const app = express();
app.use(express.json());
const instruction = `As the hiring manager's assistant, your core responsibilities involve assisting users in crafting job descriptions, refining their quality, and generating transparent Markdown-based descriptions for upcoming positions.

First, you have to ask the title of the open position 

Upon initiation, the initial query posed to the user pertains to the Position Name. Subsequently, two distinct approaches to job description creation emerge: AI-based or manual.

For AI-Based Job Description:

1. Please inquire about all the necessary details for the job description creation, and feel free to ask additional questions based on both user responses and your knowledge about the open position. Ensure a comprehensive understanding of the requirements to produce a high-quality job description.

For Manual Job Description:

1. Paste the manual job description provided by the user and validate the inclusion of all required information.
2. Analyze the job description and ensure all required information is included. If anything is missing, ask one by one questions about all the the absent details. Additionally, pose other questions based on the manual job description to gain a clear understanding of the job requirements.

Require questions for both AI-based and manual job description creation.

1. Education Background: Specify the required educational qualifications for the position.
2. Experience Requirement: Seek clarification on whether "3+ years" is a general requirement or specific to a certain position.
3. Job Location
4. Job Type (e.g., On-site, Hybrid, Remote)
5. Special Skills Required with Experience
6. Responsibilities
7. Salary Range (including currency)

You are welcome to ask additional questions based on user responses and your knowledge. Ensure to validate all the answers for accuracy.

Throughout the process, it is imperative to offer error messages for inaccuracies and prompt users for corrections. For instance, if "Finland" is entered as a position name, guide the user to rectify the error. Following these interactions, proceed to generate a well-formatted Markdown job description based on the collected information.
`

// import the required dependencies
require("dotenv").config();
const OpenAI = require("openai");
const readline = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout,
});
const http = require("http");
var cors = require("cors");
// Create a OpenAI connection
const secretKey = process.env.OPENAI_API_KEY;
const openai = new OpenAI({
  apiKey: secretKey,
});
app.use(cors());
let assistant = null;
let thread = null;
app.get("/create-assistant", async (req, res) => {
  console.log("/create-assistant");
  assistant = await openai.beta.assistants.create({
    name: "Hiring manager ASSISTANT",
    instructions:
      instruction,
    model: "gpt-3.5-turbo-16k",
  });
  res.status(200).json("Assistant Is created");
});
app.get("/create-thread", async (req, res) => {
  // Create a thread
  thread = await openai.beta.threads.create();
  res.status(200).json("Thread Is created");
});

app.post("/get-msg", async (req, res) => {
  const { msg } = req.body;
  try {
    // Pass in the user question into the existing thread
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: msg,
    });

    // Use runs to wait for the assistant response and then retrieve it
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistant.id,
    });

    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);

    // Polling mechanism to see if runStatus is completed
    // This should be made more robust.
    while (runStatus.status !== "completed") {
      await new Promise((resolve) => setTimeout(resolve, 500));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }
    // Get the last assistant message from the messages array
    const messages = await openai.beta.threads.messages.list(thread.id);
    // Find the last message for the current run
    const lastMessageForRun = messages.data
      .filter(
        (message) => message.run_id === run.id && message.role === "assistant"
      )
      .pop();

    // If an assistant message is found, console.log() it
    if (lastMessageForRun) {
      res.status(200).json(`${lastMessageForRun.content[0].text.value} \n`);
    }
  } catch (error) {
    console.error(error);
  }
});
app.post("/generate-json", async (req, res) => {
  const { conversation } = req.body;
  
  const instruction = `from the conversation array please create the Jason which has the key position name, salary, job location, experience, qualification, and job description you have to fill all the values from the above conversation, and value should be to the point except from the job description, job description could be long and with proper markdown; here is conversation ${JSON.stringify(conversation)} array`;


  console.log("instruction '= ", instruction);


  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        "role": "user",
        "content": instruction
      }
    ],
    // message: conversation,
    // prompt: instruction,
    temperature: 1,
    max_tokens: 256,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  });
  console.log("response", response)
  console.log("Data response :- ", response?.choices?.[0]?.message?.content);
  res.status(200).json(response);

})
// Set up the server to listen on port 3000
const port = 3000;
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
