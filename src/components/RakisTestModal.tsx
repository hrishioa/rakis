import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";

interface RakisTestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const RakisTestModal: React.FC<RakisTestModalProps> = ({ isOpen, onClose }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl p-8">
        <DialogHeader>
          <DialogTitle className="text-3xl font-bold mb-4">
            Rakis Stability Test 1 has ended
          </DialogTitle>
          <DialogDescription className="text-lg space-y-4">
            <p className="font-semibold">
              Thank you for your participation in the Rakis stability test!
            </p>
            <p>We&apos;ve achieved remarkable results:</p>
            <ul className="list-disc list-inside my-4 pl-4">
              <li>Over 26 million tokens inferenced</li>
              <li>More than 2,000 nodes participated</li>
            </ul>
            <p>
              Your participation has been valued and counted in the last
              snapshot taken on 24.07.2024.
            </p>
            <p>
              An early analysis of the results snapshot is available at{" "}
              <a
                href="https://rakis-st1-results.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline font-medium"
              >
                https://rakis-st1-results.vercel.app/
              </a>
            </p>
            <p>
              We&apos;ve all proved together that a peer to peer inference
              network can exist in browser alone with no servers anywhere.
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-8 flex flex-col items-center">
          <p className="text-xs mt-4 text-gray-500">
            change made by{" "}
            <a
              href="https://github.com/hrishioa/mandark"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              Mandark
            </a>
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RakisTestModal;
