"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { IDENTITY_ENCRYPTED_KEY } from "../core/synthient-chain/thedomain/settings";
import { initClientInfo } from "../core/synthient-chain/identity";
import { useToast } from "../components/ui/use-toast";
import Dashboard from "../components/core/dashboard";

export default function Home() {
  const [password, setPassword] = useState("");
  const [overwriteIdentity, setOverwriteIdentity] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [existingIdentity, setExistingIdentity] = useState(false);

  const { toast } = useToast();

  const handlePasswordSubmit = () => {
    console.log("Trying to decrypt identity");
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
          description: "Please try again!",
        });
      }
    })();
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.localStorage.getItem(IDENTITY_ENCRYPTED_KEY))
        setExistingIdentity(true);
    }
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Log into Rakis</CardTitle>
          </CardHeader>
          <CardContent>
            <input
              type="password"
              placeholder={
                existingIdentity ? "Enter password" : "Create a password"
              }
              value={password}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handlePasswordSubmit();
                }
              }}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 mt-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
            {existingIdentity && (
              <div className="mt-4">
                <Checkbox
                  id="overwriteIdentity"
                  checked={overwriteIdentity}
                  onCheckedChange={(checked) => setOverwriteIdentity(!!checked)}
                />
                <label
                  htmlFor="overwriteIdentity"
                  className="text-sm ml-2 font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Overwrite existing identity?
                </label>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <button
              onClick={handlePasswordSubmit}
              className="px-4 py-2 font-bold text-white bg-blue-500 rounded-full hover:bg-blue-700"
            >
              Enter A Rakis
            </button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <Dashboard
      identityPassword={password}
      overwriteIdentity={false} // Already created when we test it
    />
  );
}
