import {
  Box,
  Button,
  Code,
  Flex,
  Heading,
  Link,
  Popover,
  RadioCards,
  Text,
  TextField,
} from "@radix-ui/themes";
import { useLocalStorage } from "@uidotdev/usehooks";
import { KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const components = {
  h1: ({ node, ...props }: { node: any }) => <Heading size="4" {...props} />,
  h2: ({ node, ...props }: { node: any }) => <Heading size="3" {...props} />,
  h4: ({ node, ...props }: { node: any }) => <Heading size="1" {...props} />,
  p: ({ node, ...props }: { node: any }) => <Text as="p" size="2" {...props} />,
};

export default function LiveHelp() {
  const [helpAPIKey, saveHelpAPIKey] =
    useLocalStorage<string>("rakisHelpApiKey");
  const [coreCode, setCoreCode] = useLocalStorage(
    "rakisCoreCode",
    "uninitialized"
  );
  const [introPost, setIntroPost] = useLocalStorage(
    "rakisIntroPost",
    "uninitialized"
  );

  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState<"smart" | "dumb">("smart");
  const [aiModel, setAIModel] = useState<any>(null);
  const [aiResponse, setAIResponse] = useState("");
  const [question, setQuestion] = useState("");

  useEffect(() => {
    if (helpAPIKey) {
      if (getAPIKeyType(helpAPIKey) === "anthropic") {
        console.log("Setting help provider to anthropic");
        const provider = createAnthropic({
          apiKey: helpAPIKey,
        });
        setAIModel(
          model === "smart"
            ? provider("claude-3-5-sonnet-20240620")
            : provider("claude-3-haiku-20240307")
        );
      } else if (getAPIKeyType(helpAPIKey) === "openai") {
        console.log("Setting help provider to openai");
        const provider = createOpenAI({
          apiKey: helpAPIKey,
        });
        setAIModel(
          model === "smart"
            ? provider("gpt-4-turbo-2024-04-09")
            : provider("gpt-4o")
        );
      }
    }
  }, [helpAPIKey, model, setAIModel]);

  function getAPIKeyType(apiKey: string) {
    if (apiKey.startsWith("sk-ant") && apiKey.length === 108)
      return "anthropic";
    else if (apiKey.startsWith("sk-proj") && apiKey.length === 56)
      return "openai";
    else return false;
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (coreCode === "uninitialized") {
        console.log("Setting core code");
        fetch(
          "https://raw.githubusercontent.com/hrishioa/rakis/master/help/core-code-for-LLMs.txt"
        )
          .then((res) => res.text())
          .then((code) => setCoreCode(code));
      }
    }
  }, [coreCode, setCoreCode]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (introPost === "uninitialized") {
        console.log("Setting intro post");
        fetch(
          "https://raw.githubusercontent.com/hrishioa/rakis/master/help/intro-post.txt"
        )
          .then((res) => res.text())
          .then((post) => setIntroPost(post));
      }
    }
  }, [introPost, setIntroPost]);
  return (
    <Popover.Root>
      <Popover.Trigger>
        <Button variant="soft" size="2" color="bronze">
          Ask Questions
        </Button>
      </Popover.Trigger>
      <Popover.Content maxWidth="450px">
        {coreCode !== "uninitialized" && introPost !== "uninitialized" ? (
          <Flex gap="2" direction="column">
            <Text as="div" size="2">
              Ask questions about Rakis, after plugging in an{" "}
              <Link
                href="https://platform.openai.com/account/api-keys"
                target="_blank"
              >
                OpenAI
              </Link>{" "}
              {/* or{" "}
              <Link
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
              >
                Anthropic
              </Link>{" "} */}
              key (your keys are local to this browser). We use this file and
              this one as context (about 40k tokens). If you like an answer or
              would like to fact-check, tweet @hrishioa with a screenshot!
            </Text>
            <TextField.Root
              placeholder={helpAPIKey ? "Save new key..." : "Enter a key…"}
              type="password"
              size="2"
              value={apiKey}
              onInput={(event) => setApiKey(event.currentTarget.value)}
            >
              <TextField.Slot>
                <KeyRound width={16} height={16} />
              </TextField.Slot>
              {apiKey && getAPIKeyType(apiKey) && (
                <TextField.Slot>
                  <Button
                    size="1"
                    variant="outline"
                    color="green"
                    onClick={() => saveHelpAPIKey(apiKey)}
                  >
                    {helpAPIKey
                      ? helpAPIKey !== apiKey
                        ? "Update"
                        : "Saved"
                      : "Save"}
                  </Button>
                </TextField.Slot>
              )}
            </TextField.Root>
            {helpAPIKey ? (
              <Box maxWidth="600px">
                <Text size="1" mb="4">
                  Pick a model
                </Text>
                <RadioCards.Root
                  columns={{ initial: "smart", sm: "2" }}
                  onValueChange={(value) => setModel(value as "smart" | "dumb")}
                  value={model}
                >
                  <RadioCards.Item value="smart">
                    <Flex direction="column" width="100%">
                      <Text weight="bold" size="2">
                        Smart
                      </Text>
                      <Text size="2">
                        {getAPIKeyType(helpAPIKey as string) === "anthropic"
                          ? "Sonnet 3.5"
                          : "GPT-4"}
                      </Text>
                    </Flex>
                  </RadioCards.Item>
                  <RadioCards.Item value="dumb">
                    <Flex direction="column" width="100%">
                      <Text weight="bold">Dumb</Text>
                      <Text>
                        {getAPIKeyType(helpAPIKey as string) === "anthropic"
                          ? "Haiku"
                          : "GPT-4o"}
                      </Text>
                    </Flex>
                  </RadioCards.Item>
                </RadioCards.Root>
              </Box>
            ) : null}
            {aiModel ? (
              <TextField.Root
                size="3"
                placeholder="Ask Question!"
                value={question}
                onInput={(e) => setQuestion(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && question) {
                    (async () => {
                      setAIResponse("Asking...");
                      const response = await streamText({
                        model: aiModel,
                        prompt: `<Code>${coreCode}</Code>\n<IntroPost>${introPost}</IntroPost>\n\nPlease use the code and the introductory post to answer the following question: ${question}. Answer in markdown and well formatted.`,
                      });

                      let fullMessage = "";
                      for await (const textPart of response.textStream) {
                        fullMessage += textPart;
                        setAIResponse(fullMessage);
                      }
                    })();
                  }
                }}
              ></TextField.Root>
            ) : null}
            {aiResponse ? (
              <Box maxHeight="300px" overflowY="scroll">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1({ children }) {
                      return (
                        <Heading size="4" mt="3">
                          {children}
                        </Heading>
                      );
                    },
                    h2({ children }) {
                      return (
                        <Heading size="3" mt="3">
                          {children}
                        </Heading>
                      );
                    },
                    h3({ children }) {
                      return (
                        <Heading size="2" mt="3">
                          {children}
                        </Heading>
                      );
                    },
                    h4({ children }) {
                      return (
                        <Heading size="1" mt="3">
                          {children}
                        </Heading>
                      );
                    },
                    h5({ children }) {
                      return (
                        <Heading size="1" mt="3">
                          {children}
                        </Heading>
                      );
                    },
                    p(props) {
                      const { children } = props;
                      return (
                        <Text as="p" size="2" mt="2">
                          {children}
                        </Text>
                      );
                    },
                    code(props) {
                      const { children } = props;
                      return (
                        <Code size="2" style={{ margin: "10px" }}>
                          {children}
                        </Code>
                      );
                    },
                  }}
                >
                  {aiResponse}
                </ReactMarkdown>
                {/* <Text
                  as="div"
                  size="2"
                  color="grass"
                  weight="medium"
                  style={{
                    padding: "10px",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {aiResponse}
                </Text> */}
              </Box>
            ) : null}
          </Flex>
        ) : (
          <Text size="1">Loading Artifacts...</Text>
        )}
      </Popover.Content>
    </Popover.Root>
  );
}
