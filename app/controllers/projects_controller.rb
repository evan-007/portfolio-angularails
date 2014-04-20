class ProjectsController < ApplicationController
	before_action :authenticate_user!, only: [:new, :create, :edit, :update, :destroy, :admin]
	before_action :set_project, only: [:edit, :update, :destroy, :show]

	def index
		@projects = Project.all
		render json: @projects 
	end

	def show
		render json: @project
	end

	def admin
		@projects = Project.all
	end

	def new
		@project = Project.new
	end

	def create
		@project = Project.new(project_params)
		if @project.save
			flash[:notice] = "Successfully created..."
			redirect_to admin_path
		else
			flash[:notice] = "uhoh"
		end
	end

	def edit
	end

	def update
		if @project.update(project_params)
			flash[:notice] = "Successfully updated..."
			redirect_to admin_path
		else
			flash[:notice] = "uhoh"
			redirect_to admin_path
		end
	end

	def destroy
		if @project.destroy
			flash[:notice] = "Successfully destroyed..."
			redirect_to admin_path
		else
			flash[:notice] = "uhoh"
			redirect_to admin_path
		end
	end

	private

	def set_project
		@project = Project.find(params[:id])
	end

	def project_params
		params.require(:project).permit(:title, :description, :git,
		:image, :link, :tag_list, tag_ids: [])
	end
end