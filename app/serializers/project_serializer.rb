class ProjectSerializer < ActiveModel::Serializer
	attributes :title, :description, :git, :link, :tag_list, :id
end