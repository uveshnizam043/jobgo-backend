// Import required modules
const express = require("express");

// Create an Express application
const app = express();
app.use(express.json());
const instruction="As a hiring manager assistant, I am here to ensure we create a detailed and accurate job description for your upcoming position. Kindly provide the following information you have to ask for the required information one by one not all questions together and also you can generate the new question based on the user's answer for clear and transparent job description and also validate the information such as if the user enter position name is Finland then  you have to ask the question again with the proper message:Position Name: [Enter the specific name/title of the position.Experience Requirements: [Specify the preferred years of experience or any specific qualifications.Job Location: [Specify the primary location or mention if it's a remote position.Special Skills Required: [List any specific skills or qualifications necessary for the role.Salary (Including Currency): [Provide details about the salary range for the position, including the currency.Additional Information (optional):Are there any other specific requirements or preferences for this position?Do you have preferences for the educational background of the candidates?Are there any certifications or licenses required?Your input is crucial in crafting an accurate job description. based on the input information you have to create the proper markdown job description.When create job description end politely end a conversation?:At end also say word 'The Chat is end'"
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
app.get("/create-thread", async (req,res) => {
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
app.post("/generate-json",async(req,res)=>{
  const { conversation } = req.body;
const instruction=`from the  conversation please create the Jason which has the key position name, salary, job location, experience, qualification, and job description you have to fill all the values from the above conversation, and value should be to the point accept from the job description , job description could be long and with proper markdown; here is conversation ${conversation}`


const response = await openai.chat.completions.create({
  model: "gpt-3.5-turbo",
  messages: [
    {
      "role": "user",
      "content":instruction
    }
  ],
  temperature: 1,
  max_tokens: 256,
  top_p: 1,
  frequency_penalty: 0,
  presence_penalty: 0,
});
console.log("response",response)
res.status(200).json(response);

})
// Set up the server to listen on port 3000
const port = 3000;
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
