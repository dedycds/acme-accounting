import { Body, ConflictException, Controller, Get, Post } from '@nestjs/common';
import { Company } from '../../db/models/Company';
import {
  Ticket,
  TicketCategory,
  TicketStatus,
  TicketType,
} from '../../db/models/Ticket';
import { User, UserRole } from '../../db/models/User';

/**
 * Data Transfer Object for creating a new ticket
 * @interface newTicketDto
 */
interface newTicketDto {
  type: TicketType;
  companyId: number;
}

/**
 * Data Transfer Object for ticket response
 * @interface TicketDto
 */
interface TicketDto {
  id: number;
  type: TicketType;
  companyId: number;
  assigneeId: number;
  status: TicketStatus;
  category: TicketCategory;
}

/** Globals */
/** Roles that must be unique per company */
const UNIQUE_ROLES = [UserRole.corporateSecretary, UserRole.director];

/**
 * Controller for managing tickets in the ACME accounting system
 * Handles ticket creation, retrieval, and assignment logic
 */
@Controller('api/v1/tickets')
export class TicketsController {
  /**
   * Retrieves all tickets with their associated company and user information
   * @returns {Promise<Ticket[]>} Array of tickets with populated company and user data
   */
  @Get()
  async findAll() {
    return await Ticket.findAll({ include: [Company, User] });
  }

  /**
   * Creates a new ticket with automatic assignee selection based on ticket type and business rules
   *
   * Business Rules:
   * - Management Report tickets are assigned to accountants
   * - Registration Address Change tickets are assigned to corporate secretaries
   * - If no corporate secretary exists for registration address change, falls back to director
   * - Only one registration address change ticket per company is allowed
   * - Corporate secretaries or directors must be unique (only one per company)
   *
   * @param {newTicketDto} newTicketDto - The ticket creation data
   * @returns {Promise<TicketDto>} The created ticket data
   * @throws {ConflictException} When:
   *   - Duplicate registration address change ticket exists
   *   - No suitable assignee found for the ticket type
   *   - Multiple corporate secretaries or directors exist (business rule violation)
   */
  @Post()
  async create(@Body() newTicketDto: newTicketDto) {
    const { type, companyId } = newTicketDto;

    // Determine ticket category based on type
    const category =
      type === TicketType.managementReport
        ? TicketCategory.accounting
        : TicketCategory.corporate;

    // Determine initial user role based on ticket type
    let userRole =
      type === TicketType.managementReport
        ? UserRole.accountant
        : UserRole.corporateSecretary;

    // Check for duplicate registration address change tickets
    // Business rule: Only one registrationAddressChange ticket per company
    if (type === TicketType.registrationAddressChange) {
      const existingTicket = await Ticket.findOne({
        where: { companyId, type },
        attributes: ['id'],
      });

      if (existingTicket)
        throw new ConflictException(`Ticket with type ${type} already exists`);
    }

    // Find users with the primary role for this ticket type
    let assignees = await User.findAll({
      where: { companyId, role: userRole },
      order: [['createdAt', 'DESC']], // Get most recently created user first
    });

    // Fallback logic: If no corporate secretary exists for registration address change,
    // try to assign to a director instead
    if (!assignees.length && type === TicketType.registrationAddressChange) {
      userRole = UserRole.director;
      assignees = await User.findAll({
        where: { companyId, role: userRole },
        order: [['createdAt', 'DESC']],
      });
    }

    // Validate that we have at least one assignee
    if (!assignees.length)
      throw new ConflictException(
        `Cannot find user with role ${userRole} to create a ticket`,
      );

    // Business rule: Corporate secretaries or directors must be unique per company
    if (UNIQUE_ROLES.includes(userRole) && assignees.length > 1)
      throw new ConflictException(
        `Multiple users with role ${userRole}. Cannot create a ticket`,
      );

    // Select the first (most recently created) assignee
    const assignee = assignees[0];

    // Create the ticket with the determined assignee and category
    const ticket = await Ticket.create({
      companyId,
      assigneeId: assignee.id,
      category,
      type,
      status: TicketStatus.open,
    });

    // Transform the ticket data for the response
    const ticketDto: TicketDto = {
      id: ticket.id,
      type: ticket.type,
      assigneeId: ticket.assigneeId,
      status: ticket.status,
      category: ticket.category,
      companyId: ticket.companyId,
    };

    return ticketDto;
  }
}
