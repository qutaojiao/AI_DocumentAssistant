
import { UUID } from "https://unpkg.com/uuidjs@^5";
// const uuid = UUID.generate();

let conversation_id = "aa36352a-4ec6-4c94-847e-7ae0be124e0a";
let message_id = '';
let parent_message_id = 'aaa273aa-0512-4b78-ada2-7ea2aba7a365';
let end_turn = false;
let action = 'next';


// const API_URL = "https://api.openai.com/v1/chat/completions";
const API_URL = "https://ai.fakeopen.com/api/conversation";
// const API_URL = "https://bypass.churchless.tech/api/conversation";

const OPENAI_TOKEN = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ik1UaEVOVUpHTkVNMVFURTRNMEZCTWpkQ05UZzVNRFUxUlRVd1FVSkRNRU13UmtGRVFrRXpSZyJ9.eyJodHRwczovL2FwaS5vcGVuYWkuY29tL3Byb2ZpbGUiOnsiZW1haWwiOiJ6ZXJvcGx1c2h5bEBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZX0sImh0dHBzOi8vYXBpLm9wZW5haS5jb20vYXV0aCI6eyJ1c2VyX2lkIjoidXNlci1rWk9xNFpRcXRqbHBZY2liMGtwZ2NxQXIifSwiaXNzIjoiaHR0cHM6Ly9hdXRoMC5vcGVuYWkuY29tLyIsInN1YiI6Imdvb2dsZS1vYXV0aDJ8MTA3MTA0MzkzMzAwMzg2NzM2NjUxIiwiYXVkIjpbImh0dHBzOi8vYXBpLm9wZW5haS5jb20vdjEiLCJodHRwczovL29wZW5haS5vcGVuYWkuYXV0aDBhcHAuY29tL3VzZXJpbmZvIl0sImlhdCI6MTY4NjM3NTE0MCwiZXhwIjoxNjg3NTg0NzQwLCJhenAiOiJUZEpJY2JlMTZXb1RIdE45NW55eXdoNUU0eU9vNkl0RyIsInNjb3BlIjoib3BlbmlkIHByb2ZpbGUgZW1haWwgbW9kZWwucmVhZCBtb2RlbC5yZXF1ZXN0IG9yZ2FuaXphdGlvbi5yZWFkIG9yZ2FuaXphdGlvbi53cml0ZSJ9.l-Jd3bZ7PitPENEY5a1vajttmzW9NcPVTazJFp48YhsYX1_UTa_xIZikhJelFC3LKRa8FhydFysCkIkwQSWJdC2WfBJNiLZKkRsoQRSnRFhQY4DWzYBwLqKIO4JbJslKhp3ka7BsrnrOgzA7-iHrAEG2fm16vUg9O7C5AzE8pE8sN5Gnwpm8YHEVaG7hDoAV_Q9VY18vPc-GlWO-6a8Ymyo2xBrm7QJYqR-fjyFC7aNwope3wRJwX2XKyLbC7Xy188Dop1BoBiU-SFi9T6UXE8wtBCXLWSoo9fayO1fglvLJeObHuXm4UPOKwqvpPXv5FcRK5HIjTEtVVbbKnTvlIA";

const promptInput = document.getElementById("promptInput");
const urlInput = document.getElementById("urlInput");
const editorText = document.getElementById("editorText");
const generateBtn = document.getElementById("generateBtn");
const continueBtn = document.getElementById("continueBtn");
const stopBtn = document.getElementById("stopBtn");
const resultText = document.getElementById("resultText");
const getUrlContentBtn = document.getElementById("getUrlContentBtn");


continueBtn.disabled = true;


// console.log(uuid); // 输出一个随机生成的UUID

let controller = null; // Store the AbortController instance

const generate = async () => {
  // Alert the user if no prompt value
  if (!promptInput.value) {
    alert("请输入提示词");
    return;
  }

  // Disable the generate button and enable the stop button
  generateBtn.disabled = true;
  stopBtn.disabled = false;
  resultText.innerText = "Generating...";


  // Create a new AbortController instance
  controller = new AbortController();
  const signal = controller.signal;



  try {
    message_id = UUID.generate();
    // Fetch the response from the OpenAI API with the signal from AbortController
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_TOKEN}`,
      },
      body: JSON.stringify({
        "action": action,
        "messages": [
          {
            "id": message_id,
            "author": {
              "role": "user"
            },
            "content": {
              "content_type": "text",
              "parts": [
                promptInput.value+":"+editorText.value
              ]
            },
            "metadata": {}
          }
        ],
        "conversation_id": conversation_id,
        "parent_message_id": parent_message_id,
        "model": "gpt-3.5-turbo",
        "timezone_offset_min": -480,
        "history_and_training_disabled": false,
        "arkose_token": null
      }),
      signal, // Pass the signal to the fetch request
    });

    // Read the response as a stream of data
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    resultText.innerText = "";

    let temp_parent_message_id='';
    while (true) {
      const { done, value } = await reader.read();
      console.log(done)

      // 对大块数据进行消息处理和解析
      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");
      
      const parsedLines = lines
        .map((line) => line.replace(/^data: /, "").trim())
        .filter((line) => (
          line !== "" &&
          line !== "[DONE]" &&
          line !== "\r"
        ))
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch (e) {
            return line;
          }
        })
        .filter((line) => typeof line === "object");
        console.log(parsedLines);

      
      for (const parsedLine of parsedLines) {
        const { message } = parsedLine;
        
        const { content } = message;
        let content2 = content.parts[0];
        parent_message_id = message.id;
        end_turn = message.end_turn;
        // Update the UI with the new content
        if (content) {
          resultText.innerHTML = marked.parse(content2);;

          
        }
      }

      console.log(end_turn);



      if (done) {
        if (!end_turn) {  //如果没有结束，则可以继续
          console.log("继续输出");
          // continueGenerate(); //继续执行
          continueBtn.disabled = false;
        } else {
          continueBtn.disabled = true;
          console.log("完成输出");
          // parent_message_id = temp_parent_message_id;
          console.log("parent_message_id",parent_message_id);
          editorText.value = "";
        }
        console.log(done)
        break;
      }




    }
  } catch (error) {
    // Handle fetch request errors
    if (signal.aborted) {
      resultText.innerText = "请求已中止。";
    } else {
      console.error("Error:", error);
      resultText.innerText = "生成时发生错误。";
    }
  } finally {
    // Enable the generate button and disable the stop button
    generateBtn.disabled = false;
    stopBtn.disabled = true;
    controller = null; // Reset the AbortController instance

  }
};

// 继续生成
const continueGenerate = async () => {  

  // Disable the generate button and enable the stop button
  generateBtn.disabled = true;
  continueBtn.disabled = true;
  stopBtn.disabled = false;

  // Create a new AbortController instance
  controller = new AbortController();
  const signal = controller.signal;



  try {
    message_id = UUID.generate();
    // Fetch the response from the OpenAI API with the signal from AbortController
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_TOKEN}`,
      },
      body: JSON.stringify({
        "action": "continue",
        "conversation_id": conversation_id,
        "parent_message_id": parent_message_id,
        "model": "text-davinci-002-render-sha",
        "timezone_offset_min": -480,
        "history_and_training_disabled": false,
        "arkose_token": null
      }),
      signal, // Pass the signal to the fetch request
    });

    // Read the response as a stream of data
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    const originalText = resultText.innerText;

    let temp_parent_message_id='';
    while (true) {
      const { done, value } = await reader.read();
      console.log(done)

      // 对大块数据进行消息处理和解析
      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");
      const parsedLines = lines
        .map((line) => line.replace(/^data: /, "").trim())
        .filter((line) => (
          line !== "" &&
          line !== "[DONE]" &&
          line !== "\r"
        ))
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch (e) {
            return line;
          }
        })
        .filter((line) => typeof line === "object");


        
      for (const parsedLine of parsedLines) {
        const { message } = parsedLine;
        console.log(parsedLine);
        const { content } = message;
        let content2 = content.parts[0];
        parent_message_id = message.id;
        end_turn = message.end_turn;
        // Update the UI with the new content
        if (content) {
          resultText.innerText = originalText + content2;
        }
      }

      if (done) {
        if (!end_turn) {  //如果没有结束，则可以继续
          console.log("继续输出");
          continueGenerate(); //继续执行
          continueBtn.disabled = false;
        } else {
          continueBtn.disabled = true;
          console.log("完成输出");
          // parent_message_id = temp_parent_message_id;
          console.log("parent_message_id",parent_message_id);
          editorText.value = "";
        }
        console.log(done)
        break;
      }




    }
  } catch (error) {
    // Handle fetch request errors
    if (signal.aborted) {
      resultText.innerText = "Request aborted.";
    } else {
      console.error("Error:", error);
      resultText.innerText = "Error occurred while generating.";
    }
  } finally {
    // Enable the generate button and disable the stop button
    generateBtn.disabled = false;
    stopBtn.disabled = true;
    controller = null; // Reset the AbortController instance
  }
};

const stop = () => {
  // Abort the fetch request by calling abort() on the AbortController instance
  if (controller) {
    controller.abort();
    controller = null;
  }
};

// 获取url内容
const getUrlContent = async () => {
  const options = {
    method: 'GET'
  };

  editorText.value = '';


  getUrlContentBtn.disabled = true;

  try {
    const response = await fetch(`/getPageContent?url=${urlInput.value}`, options);
    const data = await response.json();
    const { body } = data;
    editorText.value = body;
    console.log(body);
  } catch (err) {
    console.error(err);
  } finally {
    getUrlContentBtn.disabled = false;
  }
};

promptInput.addEventListener("keyup", (event) => {
  if (event.key === "Enter") {
    generate();
  }
});


// 字符统计
const charCount = document.getElementById("charCount");
let countEditor=0;
let countPrompt=0;
editorText.addEventListener("input", function() {
  countEditor = editorText.value.length;
  charCount.textContent = countPrompt + countEditor + "/30000";
});

promptInput.addEventListener("input", function() {
  countPrompt = promptInput.value.length;
  charCount.textContent = countPrompt + countEditor + "/30000";
});


generateBtn.addEventListener("click", generate);
continueBtn.addEventListener("click", continueGenerate);
stopBtn.addEventListener("click", stop);
getUrlContentBtn.addEventListener("click", getUrlContent);



