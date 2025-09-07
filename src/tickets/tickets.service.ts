import { ConflictException, Injectable } from '@nestjs/common';
import {
  Ticket,
  TicketCategory,
  TicketStatus,
  TicketType,
} from '../../db/models/Ticket';
import { User, UserRole } from '../../db/models/User';
import { Company } from '../../db/models/Company';
import { Op } from 'sequelize';

/** Globals */
/** Roles that must be unique per company */
const UNIQUE_ROLES = [UserRole.corporateSecretary, UserRole.director];

/**
 * Service for managing ticket business logic and operations
 * Handles ticket creation, assignment, and validation rules
 */
@Injectable()
export class TicketsService {
  /**
   * Creates a new ticket with automatic assignee selection based on business rules
   *
   * Business Rules:
   * - Management Report tickets are assigned to accountants
   * - Registration Address Change tickets are assigned to corporate secretaries
   * - If no corporate secretary exists for registration address change, falls back to director
   * - Only one registration address change ticket per company is allowed
   * - Corporate secretaries must be unique (only one per company)
   *
   * @param {Object} createTicketDto - The ticket creation data
   * @param {TicketType} createTicketDto.type - The type of ticket to create
   * @param {number} createTicketDto.companyId - The ID of the company
   * @returns {Promise<Object>} The created ticket data
   * @throws {ConflictException} When business rules are violated
   */
  async createTicket(createTicketDto: { type: TicketType; companyId: number }) {
    const { type, companyId } = createTicketDto;

    // Determine ticket category and initial user role
    const category = this.getCategory(type);
    let userRole = this.getUserRole(type);

    // Check for duplicate registration address change tickets
    if (type === TicketType.registrationAddressChange) {
      await this.checkDuplicateTicket(companyId, type);
    }

    // Find users with the primary role for this ticket type
    let assignees = await this.findUsersByRole(companyId, userRole);

    // Fallback logic: If no corporate secretary exists for registration address change,
    // try to assign to a director instead
    if (!assignees.length && type === TicketType.registrationAddressChange) {
      userRole = UserRole.director;
      assignees = await this.findUsersByRole(companyId, userRole);
    }

    // Validate that we have at least one assignee
    if (!assignees.length) {
      throw new ConflictException(
        `Cannot find user with role ${userRole} to create a ticket`,
      );
    }

    // Business rule: Corporate secretaries and directors must be unique per company
    if (UNIQUE_ROLES.includes(userRole) && assignees.length > 1) {
      throw new ConflictException(
        `Multiple users with role ${userRole}. Cannot create a ticket`,
      );
    }

    // Select the first (most recently created) assignee
    const assignee = assignees[0];

    // Create the ticket
    const ticket = await Ticket.create({
      companyId,
      assigneeId: assignee.id,
      category,
      type,
      status: TicketStatus.open,
    });

    // Resolve all other tickets for the company if this is a strikeOff ticket
    if (type === TicketType.strikeOff) {
      await this.resolveOthers(companyId, ticket.id);
    }

    // Return the ticket data
    return {
      id: ticket.id,
      type: ticket.type,
      assigneeId: ticket.assigneeId,
      status: ticket.status,
      category: ticket.category,
      companyId: ticket.companyId,
    };
  }

  /**
   * Retrieves all tickets with their associated company and user information
   * @returns {Promise<Ticket[]>} Array of tickets with populated company and user data
   */
  async findAllTickets() {
    return await Ticket.findAll({ include: [Company, User] });
  }

  /**
   * Checks for duplicate registration address change tickets
   * @param {number} companyId - The company ID
   * @param {TicketType} type - The ticket type
   * @throws {ConflictException} When a duplicate ticket exists
   */
  private async checkDuplicateTicket(companyId: number, type: TicketType) {
    const existingTicket = await Ticket.findOne({
      where: { companyId, type, status: TicketStatus.open },
      attributes: ['id'],
    });

    if (existingTicket) {
      throw new ConflictException(`Ticket with type ${type} already exists`);
    }
  }

  /**
   * Finds users by company and role, ordered by creation date
   * @param {number} companyId - The company ID
   * @param {UserRole} role - The user role
   * @returns {Promise<User[]>} Array of users matching the criteria
   */
  private async findUsersByRole(companyId: number, role: UserRole) {
    return await User.findAll({
      where: { companyId, role },
      order: [['createdAt', 'DESC']], // Get most recently created user first
    });
  }

  /**
   * Get the user role for a given ticket type
   * @param {TicketType} type - The ticket type
   * @returns {UserRole} The user role
   */
  private getUserRole(type: TicketType) {
    if (type === TicketType.managementReport) {
      return UserRole.accountant;
    }
    if (type === TicketType.registrationAddressChange) {
      return UserRole.corporateSecretary;
    }
    if (type === TicketType.strikeOff) {
      return UserRole.director;
    }
    return UserRole.director;
  }

  /**
   * Get the category for a given ticket type
   * @param {TicketType} type - The ticket type
   * @returns {TicketCategory} The category
   */
  private getCategory(type: TicketType) {
    if (type === TicketType.managementReport) {
      return TicketCategory.accounting;
    }
    if (type === TicketType.registrationAddressChange) {
      return TicketCategory.corporate;
    }
    if (type === TicketType.strikeOff) {
      return TicketCategory.management;
    }
    return TicketCategory.corporate;
  }

  /**
   * Resolve all open tickets for a given company except the one with the given ID
   * @param companyId - The company ID
   * @param ticketId - The ticket ID
   * @returns {Promise<void>}
   */
  private async resolveOthers(companyId: number, ticketId: number) {
    await Ticket.update(
      { status: TicketStatus.resolved },
      {
        where: {
          companyId,
          status: TicketStatus.open,
          id: { [Op.ne]: ticketId },
        },
      },
    );
  }
}
