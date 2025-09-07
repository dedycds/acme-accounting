import { Body, Controller, Get, Post } from '@nestjs/common';
import { TicketType } from '../../db/models/Ticket';
import { TicketsService } from './tickets.service';

/**
 * Data Transfer Object for creating a new ticket
 * @interface newTicketDto
 */
interface newTicketDto {
  /** The type of ticket to be created */
  type: TicketType;
  /** The ID of the company this ticket belongs to */
  companyId: number;
}

/**
 * Controller for managing tickets in the ACME accounting system
 * Handles HTTP requests and delegates business logic to the service layer
 */
@Controller('api/v1/tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  /**
   * Retrieves all tickets with their associated company and user information
   * @returns {Promise<any[]>} Array of tickets with populated company and user data
   */
  @Get()
  async findAll() {
    return await this.ticketsService.findAllTickets();
  }

  /**
   * Creates a new ticket with automatic assignee selection
   * Delegates all business logic to the service layer
   *
   * @param {newTicketDto} newTicketDto - The ticket creation data
   * @returns {Promise<any>} The created ticket data
   */
  @Post()
  async create(@Body() newTicketDto: newTicketDto) {
    return await this.ticketsService.createTicket(newTicketDto);
  }
}
