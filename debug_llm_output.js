require('dotenv').config();
const OpenAI = require('openai');
const { buildSystemPrompt } = require('./src/services/import/promptBuilder');

const apiKey = process.env.NVIDIA_NIM_API_KEY;
const textModel = process.env.NIM_TEXT_MODEL || 'meta/llama-3.1-8b-instruct';

const client = new OpenAI({
  apiKey: apiKey,
  baseURL: 'https://integrate.api.nvidia.com/v1',
});

const content = `Input and Output in Python
Last Updated : 22 May, 2026
The print() function is used for output in various formats and the input() function enables interaction with users.
Taking Input using input()
Python's input() function is used to take user input. By default, it returns the user input in form of a string. 
name = input("Enter your name: ")
print("Hello,", name, "! Welcome!")
Output
Enter your name: GeeksforGeeks
Hello, GeeksforGeeks ! Welcome!
The code prompts the user to input their name, stores it in the variable "name" and then prints a greeting message addressing the user by their entered name.
Printing Output using print()
print() function allows us to display text, variables and expressions on the console. In the below example, "Hello, World!" is a string literal enclosed within double quotes. When executed, this statement will output the text to the console.
print("Hello, World!")
Output
Hello, World!
Printing Variables
We can use the print() function to print single and multiple variables. We can print multiple variables by separating them with commas.
s = "Brad"
print(s)
s = "Anjelina"
age = 25
city = "New York"
print(s, age, city)
Output
Brad
Anjelina 25 New York
We can also take multiple inputs at once from the user in a single line, splitting the values entered by the user into separate variables for each value using the split() method:
x, y = input("Enter two numbers: ").split()
print(x , y)
Output
Enter two numbers: 10 20
10 20
Taking Different types of User Input
We can change the user input from default string type to any other type (int, float, etc) by typecasting.
i = int(input("How old are you?: "))
f = float(input("Evaluate 7/2: "))
print(i, f)
Output
How old are you?: 23
Evaluate 7/2: 3.5
23 3.5`;

async function run() {
  const prompt = buildSystemPrompt('eng', 20);
  console.log('Sending request to', textModel);
  try {
    const response = await client.chat.completions.create({
      model: textModel,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: `Node Title: "Python"\nNode Type: "concept"\nContent:\n<user_content_data>\n${content}\n</user_content_data>` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      // No timeout here so we wait as long as it takes
    });
    console.log('SUCCESS');
    console.log('Raw Response length:', response.choices[0].message.content.length);
    console.log('Raw Response:');
    console.log(response.choices[0].message.content);
  } catch (error) {
    console.error('FAILED:', error);
  }
}

run();
