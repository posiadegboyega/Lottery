import { describe, expect, it, beforeEach } from 'vitest';
import {
  Client,
  Provider,
  ProviderRegistry,
  Result,
} from "@stacks/transactions";
import { principalCV, uintCV, someCV, noneCV, trueCV, falseCV } from "@stacks/transactions";

describe('Lottery Contract', () => {
  let client: Client;
  let provider: Provider;
  
  // Test accounts
  const deployer = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
  const participant1 = "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG";
  const participant2 = "ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC";
  const participant3 = "ST2NEB84ASENDXKYGJPQW86YXQCEFEX2ZQPG87ND";
  
  beforeEach(async () => {
    // Initialize provider and client
    provider = await ProviderRegistry.createProvider();
    client = new Client(provider);
    
    // Deploy contract
    await client.deployContract({
      name: "lottery",
      source: "<contract-source>", // Replace with actual contract source
      sender: deployer
    });
  });
  
  describe('Initial State', () => {
    it('should start with lottery inactive', async () => {
      const result = await client.callReadOnly({
        contractName: "lottery",
        functionName: "get-lottery-status",
        sender: deployer
      });
      
      expect(result).toEqual(falseCV());
    });
    
    it('should have correct ticket price', async () => {
      const result = await client.callReadOnly({
        contractName: "lottery",
        functionName: "get-ticket-price",
        sender: deployer
      });
      
      expect(result).toEqual(uintCV(1000000)); // 1 STX
    });
    
    it('should start with lottery ID 0', async () => {
      const result = await client.callReadOnly({
        contractName: "lottery",
        functionName: "get-current-lottery-id",
        sender: deployer
      });
      
      expect(result).toEqual(uintCV(0));
    });
    
    it('should start with empty prize pool', async () => {
      const result = await client.callReadOnly({
        contractName: "lottery",
        functionName: "get-prize-pool",
        sender: deployer
      });
      
      expect(result).toEqual(uintCV(0));
    });
  });
  
  describe('Starting Lottery', () => {
    it('should allow owner to start lottery', async () => {
      const result = await client.callContract({
        contractName: "lottery",
        functionName: "start-lottery",
        sender: deployer
      });
      
      expect(result.success).toBe(true);
      
      const status = await client.callReadOnly({
        contractName: "lottery",
        functionName: "get-lottery-status",
        sender: deployer
      });
      
      expect(status).toEqual(trueCV());
    });
    
    it('should not allow non-owner to start lottery', async () => {
      const result = await client.callContract({
        contractName: "lottery",
        functionName: "start-lottery",
        sender: participant1
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('err-not-owner');
    });
    
    it('should not allow starting an already active lottery', async () => {
      // Start first lottery
      await client.callContract({
        contractName: "lottery",
        functionName: "start-lottery",
        sender: deployer
      });
      
      // Try to start second lottery
      const result = await client.callContract({
        contractName: "lottery",
        functionName: "start-lottery",
        sender: deployer
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('err-lottery-active');
    });
  });
  
  describe('Buying Tickets', () => {
    beforeEach(async () => {
      // Start lottery before each test
      await client.callContract({
        contractName: "lottery",
        functionName: "start-lottery",
        sender: deployer
      });
    });
    
    it('should allow buying tickets when lottery is active', async () => {
      const result = await client.callContract({
        contractName: "lottery",
        functionName: "buy-ticket",
        sender: participant1,
        args: [uintCV(1)]
      });
      
      expect(result.success).toBe(true);
      
      const tickets = await client.callReadOnly({
        contractName: "lottery",
        functionName: "get-participant-tickets",
        sender: participant1,
        args: [principalCV(participant1)]
      });
      
      expect(tickets.value.ticket_count).toEqual(1);
    });
    
    it('should not allow buying tickets with insufficient funds', async () => {
      // Assuming participant has less than ticket price
      const result = await client.callContract({
        contractName: "lottery",
        functionName: "buy-ticket",
        sender: participant1,
        args: [uintCV(100)] // Try to buy 100 tickets
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('err-insufficient-funds');
    });
    
    it('should update prize pool correctly', async () => {
      await client.callContract({
        contractName: "lottery",
        functionName: "buy-ticket",
        sender: participant1,
        args: [uintCV(2)]
      });
      
      const prizePool = await client.callReadOnly({
        contractName: "lottery",
        functionName: "get-prize-pool",
        sender: deployer
      });
      
      expect(prizePool).toEqual(uintCV(2000000)); // 2 STX
    });
  });
  
  describe('Drawing Winner', () => {
    beforeEach(async () => {
      // Start lottery and buy tickets
      await client.callContract({
        contractName: "lottery",
        functionName: "start-lottery",
        sender: deployer
      });
      
      // Buy tickets from multiple participants
      await client.callContract({
        contractName: "lottery",
        functionName: "buy-ticket",
        sender: participant1,
        args: [uintCV(1)]
      });
      
      await client.callContract({
        contractName: "lottery",
        functionName: "buy-ticket",
        sender: participant2,
        args: [uintCV(1)]
      });
      
      await client.callContract({
        contractName: "lottery",
        functionName: "buy-ticket",
        sender: participant3,
        args: [uintCV(1)]
      });
    });
    
    it('should only allow owner to draw winner', async () => {
      const result = await client.callContract({
        contractName: "lottery",
        functionName: "draw-winner",
        sender: participant1
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('err-not-owner');
    });
    
    it('should require minimum participants before drawing', async () => {
      // Start new lottery
      await client.callContract({
        contractName: "lottery",
        functionName: "start-lottery",
        sender: deployer
      });
      
      // Try to draw with only one participant
      await client.callContract({
        contractName: "lottery",
        functionName: "buy-ticket",
        sender: participant1,
        args: [uintCV(1)]
      });
      
      const result = await client.callContract({
        contractName: "lottery",
        functionName: "draw-winner",
        sender: deployer
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('err-min-participants-not-met');
    });
    
    it('should successfully draw winner and distribute prize', async () => {
      const initialBalance1 = await client.getAccountBalance(participant1);
      const initialBalance2 = await client.getAccountBalance(participant2);
      const initialBalance3 = await client.getAccountBalance(participant3);
      const initialBalanceOwner = await client.getAccountBalance(deployer);
      
      const result = await client.callContract({
        contractName: "lottery",
        functionName: "draw-winner",
        sender: deployer
      });
      
      expect(result.success).toBe(true);
      
      // Check lottery is inactive after draw
      const status = await client.callReadOnly({
        contractName: "lottery",
        functionName: "get-lottery-status",
        sender: deployer
      });
      
      expect(status).toEqual(falseCV());
      
      // Verify balances changed appropriately
      const finalBalance1 = await client.getAccountBalance(participant1);
      const finalBalance2 = await client.getAccountBalance(participant2);
      const finalBalance3 = await client.getAccountBalance(participant3);
      const finalBalanceOwner = await client.getAccountBalance(deployer);
      
      // One of the participants should have more STX (95% of pool)
      const someoneWon = (
          finalBalance1 > initialBalance1 ||
          finalBalance2 > initialBalance2 ||
          finalBalance3 > initialBalance3
      );
      expect(someoneWon).toBe(true);
      
      // Owner should have received commission (5% of pool)
      expect(finalBalanceOwner).toBeGreaterThan(initialBalanceOwner);
    });
  });
});

