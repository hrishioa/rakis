"use client";

import { CursorArrowIcon } from "@radix-ui/react-icons";
import {
  Box,
  Button,
  Card,
  Container,
  Flex,
  Heading,
  Link,
  Switch,
  Text,
  TextField,
} from "@radix-ui/themes";
import { DEFAULT_IDENTITY_ENCRYPTED_KEY } from "../../rakis-core/synthient-chain/thedomain/settings";
import { useEffect, useState } from "react";
import { initClientInfo } from "../../rakis-core/synthient-chain/identity";
import { toast } from "../../components/ui/use-toast";
import Dashboard from "./components/dashboard";

export default function Home() {
  const [existingIdentity, setExistingIdentity] = useState<boolean>(false);
  const [overwriteIdentity, setOverwriteIdentity] = useState(false);
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (localStorage.getItem(DEFAULT_IDENTITY_ENCRYPTED_KEY))
        setExistingIdentity(true);
    }
  }, []);

  const handlePasswordSubmit = () => {
    console.log(
      "Trying to decrypt identity with ",
      password,
      " and ",
      overwriteIdentity
    );
    (async () => {
      try {
        const testClientInfo = await initClientInfo(
          password,
          overwriteIdentity
        );

        if (testClientInfo) {
          console.log("Client info initialized successfully");
          setIsAuthenticated(true);
        } else {
          toast({
            variant: "destructive",
            title: "Could not decrypt identity.",
            description: "Please try again or overwrite!",
          });
        }
      } catch (err) {
        toast({
          variant: "destructive",
          title: "Could not decrypt identity.",
          description: "Please try again or overwrite!",
        });
      }
    })();
  };

  return isAuthenticated ? (
    <Dashboard />
  ) : (
    <Flex direction="column" justify={"center"} height={"100vh"}>
      <Flex direction="row" justify={"center"}>
        <Card variant="ghost">
          <Container size="1" p="4">
            <Heading size="9" weight={"medium"}>
              Welcome to Rakis.
            </Heading>
            <Flex justify={"end"} className="mt-2">
              <Link
                color="blue"
                href="https://twitter.com/hrishioa"
                target="_blank"
              >
                built as a two-week experiment by @hrishioa
              </Link>
            </Flex>
            <Text color="gray" as="div" size="4" className="mt-6">
              Rakis is a permissionless inference network that runs entirely in
              the browser. Choose a password below and instantly be a part of
              the network.
            </Text>{" "}
            <Flex direction="row" className="mt-3" justify={"between"}>
              <Link color="amber">The Story</Link>
              <Link color="amber">How Rakis Works</Link>
              <Link color="amber">See the code</Link>
            </Flex>
            <Flex direction="row" className="mt-6" gap="3">
              <Box flexGrow={"1"}>
                <TextField.Root
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handlePasswordSubmit();
                    }
                  }}
                  size="3"
                  variant="classic"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    existingIdentity
                      ? "Enter password..."
                      : "Create a password..."
                  }
                >
                  {existingIdentity && (
                    <TextField.Slot side="right">
                      <Text as="label" size="2">
                        <Flex gap="2">
                          <Switch
                            size="1"
                            variant="soft"
                            checked={overwriteIdentity}
                            onCheckedChange={(e) => setOverwriteIdentity(!!e)}
                          />{" "}
                          Overwrite Existing
                        </Flex>
                      </Text>
                    </TextField.Slot>
                  )}
                </TextField.Root>
              </Box>
              <Box>
                <Button
                  size="3"
                  variant="classic"
                  onClick={handlePasswordSubmit}
                >
                  <CursorArrowIcon /> Join
                </Button>
              </Box>
            </Flex>
          </Container>
        </Card>
      </Flex>
    </Flex>
  );
}
